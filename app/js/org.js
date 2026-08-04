import { state, defaultCfg } from './state.js';
import { t } from './i18n.js';
import { fmtDateTime } from './utils.js';
import { toast, showConfirm } from './ui.js';
import { renderBillingSettings } from './billing.js';

// Only used for a brand-new org's initial invite code (org creation is a
// single client-side `create` write, so there's no server round-trip to
// hook a collision check into) — every code minted after that goes through
// the regenerateInviteCode Cloud Function instead, which checks for
// collisions server-side (see functions/src/codeGen.js for why this needs
// to be crypto-random rather than Math.random). Mirrors that file's
// alphabet/length so a brand-new org's first code is exactly as strong as
// a regenerated one.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode(length = 12) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function orgRef() {
  return db.collection('orgs').doc(state.orgId);
}

// Decomposes a legacy pre-org blob doc (entries/invoices/expenses arrays +
// cfg.customers) into the current per-entity subcollections for a
// freshly-created org. Mirrors functions/scripts/migrate-to-subcollections.js.
async function migrateLegacyBlobIntoSubcollections(orgId, d) {
  const cfg = d.cfg || {};
  const rawCustomers = (cfg.customers || []).map(c => (typeof c === 'string' ? { name: c } : c));
  const customers = rawCustomers.map((c, i) => ({ ...c, id: i + 1 }));
  const sameName = (a, b) => String(a || '').localeCompare(String(b || ''), 'fi', { sensitivity: 'base' }) === 0;
  const customerIdByName = (name) => (name && customers.find(c => sameName(c.name, name))?.id) || null;
  const withCustomerId = (e) => ({ ...e, customerId: customerIdByName(e.customer) });

  const entries = (d.entries || []).map(withCustomerId);
  const invoices = (d.invoices || []).map(inv => ({
    ...inv,
    entries: (inv.entries || []).map(withCustomerId),
    expenses: (inv.expenses || []).map(withCustomerId),
  }));
  const expenses = (d.expenses || []).map(withCustomerId);

  const ref = db.collection('orgs').doc(orgId);
  const batch = db.batch();
  customers.forEach(c => batch.set(ref.collection('customers').doc(String(c.id)), c));
  entries.forEach(e => batch.set(ref.collection('entries').doc(String(e.id)), e));
  invoices.forEach(inv => batch.set(ref.collection('invoices').doc(String(inv.id)), inv));
  expenses.forEach(e => batch.set(ref.collection('expenses').doc(String(e.id)), e));
  const { customers: _drop, ...cfgFields } = cfg;
  batch.set(ref.collection('settings').doc('config'), {
    ...cfgFields,
    eId: d.eId || 0, iId: d.iId || 0, eExpId: d.eExpId || 0, cId: customers.length,
  }, { merge: true });
  await batch.commit();
}

export async function initOrg(user) {
  const userRef = db.collection('users').doc(user.uid);
  const userDoc = await userRef.get();

  if (userDoc.exists && userDoc.data().orgId) {
    state.orgId = userDoc.data().orgId;
    return;
  }

  // Check for pending join code from URL
  const joinCode = localStorage.getItem('pendingJoinCode');
  if (joinCode) {
    localStorage.removeItem('pendingJoinCode');
    const joined = await joinOrgByCode(user, joinCode);
    if (joined) return;
  }

  // Create new org for this user
  const orgId = db.collection('orgs').doc().id;
  state.orgId = orgId;

  // The code (if any) of whoever referred THIS new org — captured from a
  // ?v= link into localStorage by the landing page, one-time use.
  const referredByCode = localStorage.getItem('referralCode');
  if (referredByCode) localStorage.removeItem('referralCode');

  await db.collection('orgs').doc(orgId).set({
    name: user.displayName || user.email || 'Oma organisaatio',
    ownerId: user.uid,
    members: {
      [user.uid]: {
        role: 'owner',
        email: user.email || '',
        displayName: user.displayName || user.email || 'Vieras',
      },
    },
    inviteCode: genCode(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    ...(referredByCode ? { referredBy: referredByCode } : {}),
  });

  // Migrate existing pre-org user data (very old accounts only) straight
  // into the new org's subcollections — never into the deprecated
  // data/main blob path.
  try {
    const oldDoc = await db.collection('users').doc(user.uid).collection('data').doc('main').get();
    if (oldDoc.exists) await migrateLegacyBlobIntoSubcollections(orgId, oldDoc.data());
  } catch (_) {}

  await userRef.set({ orgId, email: user.email || '', displayName: user.displayName || user.email || 'Vieras' }, { merge: true });
}

// Joining now goes through Cloud Functions rather than a direct client
// query + write — firestore.rules can no longer let a client self-add to an
// org's members map (that used to only check the org HAD an inviteCode, not
// that the caller actually supplied the correct one), and can't let clients
// query the orgs collection by inviteCode either, without also exposing
// every org's members/billing fields to bulk enumeration (2026-08-04
// security review). lookupOrgByInviteCode is read-only, used to show the
// org's name in the confirm prompt before the user commits to joining;
// joinOrgByInviteCode does the actual join.
async function joinOrgByCode(user, code) {
  try {
    const fn = firebase.functions().httpsCallable('joinOrgByInviteCode');
    const { data } = await fn({ inviteCode: code });
    state.orgId = data.orgId;
    toast('Liityit organisaatioon: ' + data.name);
    return true;
  } catch (e) {
    toast(e.message || 'Kutsukoodi ei kelpaa.');
    return false;
  }
}

async function lookupOrgByCode(code) {
  const fn = firebase.functions().httpsCallable('lookupOrgByInviteCode');
  const { data } = await fn({ inviteCode: code });
  return data;
}

// Called when logged-in user opens a join link
export async function handleJoinLink(user, code) {
  let org;
  try {
    org = await lookupOrgByCode(code);
  } catch (e) {
    toast(e.message || 'Kutsukoodi ei kelpaa.');
    return;
  }
  showJoinPrompt(org.name, async () => {
    await joinOrgByCode(user, code);
    history.replaceState({}, '', location.pathname);
    await reloadOrgData();
  });
}

// Called from settings UI — user manually types a code
export async function joinWithCodeUI() {
  const input = document.getElementById('org-join-input');
  const code = input.value.trim().toUpperCase();
  if (!code) { toast('Syötä kutsukoodi.'); return; }

  let org;
  try {
    org = await lookupOrgByCode(code);
  } catch (e) {
    toast(e.message || 'Kutsukoodi ei kelpaa.');
    return;
  }
  if (org.orgId === state.orgId) { toast('Olet jo tässä organisaatiossa.'); return; }

  showJoinPrompt(org.name, async () => {
    const user = auth.currentUser;
    await joinOrgByCode(user, code);
    input.value = '';
    await reloadOrgData();
  });
}

async function reloadOrgData() {
  const { loadFromFirestore } = await import('./storage.js');
  // Reset state data before reload
  const { state } = await import('./state.js');
  state.entries = []; state.invoices = []; state.expenses = []; state.customers = [];
  state.eId = 0; state.iId = 0; state.eExpId = 0; state.cId = 0;
  state.cfg = defaultCfg();
  await loadFromFirestore();
  await renderOrgSettings();
}

function showJoinPrompt(orgName, onAccept) {
  document.getElementById('join-org-name').textContent = orgName;
  document.getElementById('join-modal').classList.add('open');
  window._joinAccept = onAccept;
}

export function closeJoinModal() {
  document.getElementById('join-modal').classList.remove('open');
  window._joinAccept = null;
  window.location.search = '';
}

export function confirmJoin() {
  if (window._joinAccept) window._joinAccept();
  document.getElementById('join-modal').classList.remove('open');
}

export async function loadOrgInfo() {
  if (!state.orgId) return null;
  const doc = await orgRef().get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

// Goes through a Cloud Function rather than a direct client write — the
// code needs a server-side collision check against every other org's
// inviteCode (functions/src/orgJoin.js), which a client can't safely do
// itself without the orgs collection being list-able (removed for the same
// reason the old self-join rule was, see the 2026-08-04 security review).
// firestore.rules also blocks any direct client write to inviteCode now,
// so this Cloud Function is the only way it can ever change.
export async function regenerateInviteCode() {
  const fn = firebase.functions().httpsCallable('regenerateInviteCode');
  const { data } = await fn({ orgId: state.orgId });
  return data.inviteCode;
}

export async function removeMember(uid) {
  await orgRef().update({ [`members.${uid}`]: firebase.firestore.FieldValue.delete() });
  // Best-effort cleanup: rules only allow a user to write their own doc,
  // so this may be denied. Access is already revoked via the members map.
  try {
    await db.collection('users').doc(uid).update({ orgId: firebase.firestore.FieldValue.delete() });
  } catch (_) {}
}

export async function renderOrgSettings() {
  const org = await loadOrgInfo();
  if (!org) return;

  state.orgPlan = org.plan || 'free';
  state.orgSubStatus = org.subscriptionStatus || 'none';
  state.orgPeriodEnd = org.currentPeriodEnd || null;
  state.orgLifetimeEntryCount = org.lifetimeEntryCount || 0;
  state.orgLifetimeInvoiceCount = org.lifetimeInvoiceCount || 0;
  state.orgOwnerId = org.ownerId || null;
  state.orgScheduledDeletionAt = org.scheduledDeletionAt
    ? (org.scheduledDeletionAt.toMillis ? org.scheduledDeletionAt.toMillis() : org.scheduledDeletionAt)
    : null;
  renderBillingSettings();
  renderDangerZone();

  document.getElementById('org-name-display').textContent = org.name;

  const members = Object.entries(org.members || {});
  document.getElementById('org-members-list').innerHTML = members.map(([uid, m]) => `
    <div class="org-member-row">
      <div>
        <div class="org-member-name">${esc(m.displayName || m.email || 'Tuntematon')}</div>
        <div class="org-member-email">${esc(m.email || '')}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="org-member-role">${m.role === 'owner' ? 'Omistaja' : 'Jäsen'}</span>
        ${org.ownerId === state.uid && uid !== state.uid
          ? `<button class="org-remove-btn" onclick="removeMemberUI('${uid}')">Poista</button>`
          : ''}
      </div>
    </div>`).join('');

  const inviteUrl = `${location.origin}${location.pathname}?join=${org.inviteCode}`;
  document.getElementById('org-invite-url').value = inviteUrl;

  // Guests run on a throwaway anonymous org (deleted after 30 days, see
  // cleanupAnonymousUsers) — sharing a referral link tied to it that can
  // never actually collect a reward would just be confusing, and there's no
  // point spending a code-generation call on an org that won't last.
  const referralCard = document.getElementById('referral-card');
  if (referralCard) referralCard.style.display = state.isDemo ? 'none' : '';
  if (!state.isDemo) {
    // referralCode is a Cloud-Functions-only field (firestore.rules) — a
    // client free to set its own could copy another org's code and hijack
    // the reward meant for it — so both brand-new orgs and ones created
    // before this feature shipped get theirs lazily from ensureReferralCode
    // here, which checks for collisions before writing.
    let referralCode = org.referralCode;
    if (!referralCode) {
      const fn = firebase.functions().httpsCallable('ensureReferralCode');
      const { data } = await fn({ orgId: state.orgId });
      referralCode = data.referralCode;
    }
    const referralInput = document.getElementById('referral-url');
    if (referralInput) referralInput.value = `${location.origin}/?v=${referralCode}`;
  }
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export async function copyInviteLink() {
  const val = document.getElementById('org-invite-url').value;
  await navigator.clipboard.writeText(val);
  toast('Kutsulink­ki kopioitu!');
}

// Prefers the native share sheet (mobile) so "Jaa" can hand the link
// straight to WhatsApp/Messages/etc.; falls back to clipboard copy on
// desktop or wherever navigator.share isn't available.
export async function shareReferralLink() {
  const url = document.getElementById('referral-url').value;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Hoyla', url });
      return;
    } catch (e) {
      // AbortError = user cancelled the share sheet — not an error worth
      // falling back to a clipboard copy for.
      if (e.name === 'AbortError') return;
    }
  }
  await navigator.clipboard.writeText(url);
  toast(t('referralLinkCopied'));
}

export async function refreshInviteCode() {
  const code = await regenerateInviteCode();
  const inviteUrl = `${location.origin}${location.pathname}?join=${code}`;
  document.getElementById('org-invite-url').value = inviteUrl;
  toast('Uusi kutsukoodi luotu.');
}

export async function removeMemberUI(uid) {
  if (!confirm('Poistetaanko jäsen organisaatiosta?')) return;
  await removeMember(uid);
  await renderOrgSettings();
  toast('Jäsen poistettu.');
}

function renderDangerZone() {
  const isOwner = state.orgOwnerId === state.uid;
  const deleteBtn = document.getElementById('delete-account-btn');
  const ownerHint = document.getElementById('delete-account-owner-hint');
  if (deleteBtn) deleteBtn.style.display = isOwner ? '' : 'none';
  if (ownerHint) ownerHint.style.display = isOwner ? 'none' : '';

  const def = document.getElementById('danger-zone-default');
  const pending = document.getElementById('danger-zone-pending');
  if (!def || !pending) return;

  if (state.orgScheduledDeletionAt) {
    def.style.display = 'none';
    pending.style.display = '';
    document.getElementById('deletion-scheduled-date').textContent = fmtDateTime(state.orgScheduledDeletionAt);
    const cancelBtn = pending.querySelector('button');
    if (cancelBtn) cancelBtn.style.display = isOwner ? '' : 'none';
  } else {
    def.style.display = '';
    pending.style.display = 'none';
  }
}

export function deleteAccountUI() {
  showConfirm(t('deleteAccountConfirmTitle'), t('deleteAccountConfirmText'), async () => {
    try {
      const fn = firebase.functions().httpsCallable('requestAccountDeletion');
      const { data } = await fn({ orgId: state.orgId });
      state.orgScheduledDeletionAt = data.scheduledDeletionAt;
      renderDangerZone();
      toast(`${t('deletionScheduledToast')} ${fmtDateTime(data.scheduledDeletionAt)}.`, 'success');
    } catch (e) {
      toast(e.message || t('actionFailed'));
    }
  });
}

export async function cancelAccountDeletionUI() {
  try {
    const fn = firebase.functions().httpsCallable('cancelAccountDeletion');
    await fn({ orgId: state.orgId });
    state.orgScheduledDeletionAt = null;
    renderDangerZone();
    toast(t('deletionCancelled'), 'success');
  } catch (e) {
    toast(e.message || t('actionFailed'));
  }
}

window.copyInviteLink = copyInviteLink;
window.refreshInviteCode = refreshInviteCode;
window.removeMemberUI = removeMemberUI;
window.confirmJoin = confirmJoin;
window.closeJoinModal = closeJoinModal;
window.joinWithCodeUI = joinWithCodeUI;
window.deleteAccountUI = deleteAccountUI;
window.cancelAccountDeletionUI = cancelAccountDeletionUI;
window.shareReferralLink = shareReferralLink;

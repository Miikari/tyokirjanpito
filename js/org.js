import { state } from './state.js';
import { toast } from './ui.js';

function genCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function orgRef() {
  return db.collection('orgs').doc(state.orgId);
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
  });

  // Migrate existing user data to org
  try {
    const oldDoc = await db.collection('users').doc(user.uid).collection('data').doc('main').get();
    if (oldDoc.exists) {
      await db.collection('orgs').doc(orgId).collection('data').doc('main').set(oldDoc.data());
    }
  } catch (_) {}

  await userRef.set({ orgId, email: user.email || '', displayName: user.displayName || user.email || 'Vieras' }, { merge: true });
}

async function joinOrgByCode(user, code) {
  const snap = await db.collection('orgs').where('inviteCode', '==', code).limit(1).get();
  if (snap.empty) {
    toast('Kutsukoodi ei kelpaa.');
    return false;
  }
  const orgDoc = snap.docs[0];
  state.orgId = orgDoc.id;

  await orgDoc.ref.update({
    [`members.${user.uid}`]: {
      role: 'member',
      email: user.email || '',
      displayName: user.displayName || user.email || 'Vieras',
    },
  });
  await db.collection('users').doc(user.uid).set(
    { orgId: orgDoc.id, email: user.email || '', displayName: user.displayName || user.email || 'Vieras' },
    { merge: true }
  );
  toast('Liityit organisaatioon: ' + orgDoc.data().name);
  return true;
}

// Called when logged-in user opens a join link
export async function handleJoinLink(user, code) {
  const snap = await db.collection('orgs').where('inviteCode', '==', code).limit(1).get();
  if (snap.empty) { toast('Kutsukoodi ei kelpaa.'); return; }
  const orgData = snap.docs[0].data();
  showJoinPrompt(orgData.name, async () => {
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

  const snap = await db.collection('orgs').where('inviteCode', '==', code).limit(1).get();
  if (snap.empty) { toast('Kutsukoodi ei kelpaa.'); return; }
  const orgData = snap.docs[0].data();
  if (snap.docs[0].id === state.orgId) { toast('Olet jo tässä organisaatiossa.'); return; }

  showJoinPrompt(orgData.name, async () => {
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
  state.entries = []; state.invoices = []; state.eId = 0; state.iId = 0;
  state.cfg = { hourly: 50, customers: [], recurring: [], company: '', address: '', phone: '', email: '', ytunnus: '', tilinumero: '', rounding: 15, vat: 0, showTilinumero: true, showErapaiva: true, showViitenumero: false };
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

export async function regenerateInviteCode() {
  const code = genCode();
  await orgRef().update({ inviteCode: code });
  return code;
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
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export async function copyInviteLink() {
  const val = document.getElementById('org-invite-url').value;
  await navigator.clipboard.writeText(val);
  toast('Kutsulink­ki kopioitu!');
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

window.copyInviteLink = copyInviteLink;
window.refreshInviteCode = refreshInviteCode;
window.removeMemberUI = removeMemberUI;
window.confirmJoin = confirmJoin;
window.closeJoinModal = closeJoinModal;
window.joinWithCodeUI = joinWithCodeUI;

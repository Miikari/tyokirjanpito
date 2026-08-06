import { state } from './state.js';
import { t } from './i18n.js';
import { toast } from './ui.js';

// Ordinal tier levels for "at least X" checks — mirrors
// functions/src/tiers.js's TIER_LEVEL. Add a new tier here (in order) when
// one is introduced; every isAtLeast() call site (isPro() included)
// upgrades automatically without needing to change, since a higher tier
// always satisfies a lower one's gate.
const TIER_LEVEL = { free: 0, pro: 1 };

function activePlan() {
  const active = state.orgSubStatus === 'active' || state.orgSubStatus === 'trialing';
  return active ? state.orgPlan : 'free';
}

export function isAtLeast(tier) {
  return (TIER_LEVEL[activePlan()] ?? 0) >= (TIER_LEVEL[tier] ?? 0);
}

export function isPro() {
  return isAtLeast('pro');
}

// Both createCheckoutSession/createPortalSession redirect the whole page to
// Stripe on success, so there's no moment to reset the in-flight flag/button
// there — only the error path resets them, letting the user retry.
let checkoutInProgress = false;
let portalInProgress = false;

export async function startCheckout(interval = 'month', btn) {
  if (checkoutInProgress) { toast('Odota hetki..'); return; }
  if (state.isDemo) {
    toast(t('demoNoCheckout'));
    return;
  }
  checkoutInProgress = true;
  toast('Odota hetki..');
  const origLabel = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Odota hetki..'; }
  try {
    const fn = firebase.functions().httpsCallable('createCheckoutSession');
    const { data } = await fn({ orgId: state.orgId, interval });
    window.location.href = data.url;
  } catch (e) {
    toast(e.message || t('checkoutError'));
    checkoutInProgress = false;
    if (btn) { btn.disabled = false; btn.textContent = origLabel; }
  }
}

export async function openBillingPortal(btn) {
  if (portalInProgress) { toast('Siirrytään tilauksen hallintaan..'); return; }
  portalInProgress = true;
  toast('Siirrytään tilauksen hallintaan..');
  const origLabel = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Siirrytään tilauksen hallintaan..'; }
  try {
    const fn = firebase.functions().httpsCallable('createPortalSession');
    const { data } = await fn({ orgId: state.orgId });
    window.location.href = data.url;
  } catch (e) {
    toast(e.message || t('checkoutError'));
    portalInProgress = false;
    if (btn) { btn.disabled = false; btn.textContent = origLabel; }
    if (e.code === 'functions/failed-precondition') {
      // The server already resets a stale/deleted Stripe customer back to
      // Free before throwing this — reflect that locally right away instead
      // of leaving a "Manage subscription" button pointed at dead billing.
      state.orgPlan = 'free';
      state.orgSubStatus = 'none';
      renderBillingSettings();
    }
  }
}

// Lifetime, increment-only usage counters that gate the free tier — never
// derived from state.entries.length/state.invoices.length, which a user could
// shrink again just by deleting entries/invoices. Firestore rules (firestore.rules)
// only allow these two org fields to increase, never decrease, so this can't
// be gamed even by writing to Firestore directly instead of through the UI.
export function incrementEntryCount() {
  state.orgLifetimeEntryCount++;
  renderBillingSettings();
  db.collection('orgs').doc(state.orgId).update({ lifetimeEntryCount: state.orgLifetimeEntryCount }).catch(() => {});
}

export function incrementInvoiceCount() {
  state.orgLifetimeInvoiceCount++;
  renderBillingSettings();
  db.collection('orgs').doc(state.orgId).update({ lifetimeInvoiceCount: state.orgLifetimeInvoiceCount }).catch(() => {});
}

export function showUpgradeModal() {
  const modal = document.getElementById('modal-upgrade');
  if (modal) modal.classList.add('open');
}

export function closeUpgradeModal() {
  const modal = document.getElementById('modal-upgrade');
  if (modal) modal.classList.remove('open');
}

export function handlePlanClick() {
  if (isPro()) openBillingPortal();
  else startCheckout(billingInterval);
}

// Which billing interval the free-plan "Upgrade to Pro" CTA in Settings will
// check out with — purely local UI state, not persisted, since it's just a
// choice made right before clicking Upgrade.
let billingInterval = 'month';

export function setBillingInterval(interval) {
  billingInterval = interval === 'year' ? 'year' : 'month';
  renderIntervalToggle();
}

function renderIntervalToggle() {
  ['month', 'year'].forEach(iv => {
    const btn = document.getElementById('billing-interval-' + iv);
    if (!btn) return;
    const active = billingInterval === iv;
    btn.style.background = active ? 'var(--blue)' : 'var(--surface)';
    btn.style.color = active ? '#fff' : 'var(--blue-txt)';
    btn.style.outlineColor = active ? 'var(--blue)' : 'var(--blue-txt)';
    btn.style.fontWeight = active ? '700' : '600';
  });
}

function billedHoursTotal() {
  const secs = state.entries.filter(e => e.invoiced).reduce((sum, e) => sum + e.secs, 0);
  return Math.round(secs / 3600);
}

export function renderBillingSettings() {
  const menuPlan = document.getElementById('user-menu-plan');
  const menuPlanIcon = document.getElementById('user-menu-plan-icon');
  const menuPlanText = document.getElementById('user-menu-plan-text');
  const menuPlanUpgrade = document.getElementById('user-menu-plan-upgrade');
  if (menuPlan && menuPlanIcon && menuPlanText) {
    const pro = isPro();
    menuPlan.classList.toggle('is-pro', pro);
    menuPlanIcon.textContent = pro ? 'P' : 'F';
    menuPlanText.textContent = pro ? t('menuPlanPro') : t('menuPlanFree');
    if (menuPlanUpgrade) menuPlanUpgrade.style.display = (pro || state.isDemo) ? 'none' : 'block';
  }

  const card = document.getElementById('billing-card');
  const label = document.getElementById('billing-plan-label');
  const sub = document.getElementById('billing-plan-sub');
  const cta = document.getElementById('billing-cta');
  if (!label || !sub || !cta) return;

  // Guests run on a throwaway anonymous account with no email — a Stripe
  // subscription tied to it would be unrecoverable the moment they lose
  // that browser session, so billing is hidden entirely in demo mode.
  if (card) card.style.display = state.isDemo ? 'none' : '';
  if (state.isDemo) return;

  const intervalRow = document.getElementById('billing-interval-row');

  if (isPro()) {
    label.textContent = t('planPro');
    const renews = state.orgPeriodEnd ? new Date(state.orgPeriodEnd.seconds ? state.orgPeriodEnd.seconds * 1000 : state.orgPeriodEnd).toLocaleDateString('fi-FI') : '';
    const parts = [];
    if (renews) parts.push(`${t('planProRenews')} ${renews}`);
    parts.push(t('billedHoursTotal').replace('{hours}', billedHoursTotal()));
    sub.textContent = parts.join(' · ');
    cta.style.display = '';
    cta.textContent = t('manageSubscriptionBtn');
    cta.onclick = () => openBillingPortal(cta);
    if (intervalRow) intervalRow.style.display = 'none';
  } else {
    label.textContent = t('planFree');
    sub.textContent = t('planFreeHint')
      .replace('{entries}', state.orgLifetimeEntryCount)
      .replace('{invoices}', state.orgLifetimeInvoiceCount);
    cta.style.display = '';
    cta.textContent = t('upgradeToProBtn');
    cta.onclick = () => startCheckout(billingInterval, cta);
    if (intervalRow) intervalRow.style.display = '';
    renderIntervalToggle();
  }
}

window.startCheckout = startCheckout;
window.openBillingPortal = openBillingPortal;
window.closeUpgradeModal = closeUpgradeModal;
window.handlePlanClick = handlePlanClick;
window.setBillingInterval = setBillingInterval;

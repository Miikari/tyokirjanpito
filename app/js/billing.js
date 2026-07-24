import { state } from './state.js';
import { t } from './i18n.js';
import { toast } from './ui.js';

export function isPro() {
  return state.orgPlan === 'pro' && (state.orgSubStatus === 'active' || state.orgSubStatus === 'trialing');
}

export async function startCheckout() {
  if (state.isDemo) {
    toast(t('demoNoCheckout'));
    return;
  }
  try {
    const fn = firebase.functions().httpsCallable('createCheckoutSession');
    const { data } = await fn({ orgId: state.orgId });
    window.location.href = data.url;
  } catch (e) {
    toast(t('checkoutError'));
  }
}

export async function openBillingPortal() {
  try {
    const fn = firebase.functions().httpsCallable('createPortalSession');
    const { data } = await fn({ orgId: state.orgId });
    window.location.href = data.url;
  } catch (e) {
    toast(t('checkoutError'));
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
  else startCheckout();
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

  if (isPro()) {
    label.textContent = t('planPro');
    const renews = state.orgPeriodEnd ? new Date(state.orgPeriodEnd.seconds ? state.orgPeriodEnd.seconds * 1000 : state.orgPeriodEnd).toLocaleDateString('fi-FI') : '';
    const parts = [];
    if (renews) parts.push(`${t('planProRenews')} ${renews}`);
    parts.push(t('billedHoursTotal').replace('{hours}', billedHoursTotal()));
    sub.textContent = parts.join(' · ');
    cta.style.display = '';
    cta.textContent = t('manageSubscriptionBtn');
    cta.onclick = openBillingPortal;
  } else {
    label.textContent = t('planFree');
    sub.textContent = t('planFreeHint')
      .replace('{entries}', state.orgLifetimeEntryCount)
      .replace('{invoices}', state.orgLifetimeInvoiceCount);
    cta.style.display = '';
    cta.textContent = t('upgradeToProBtn');
    cta.onclick = startCheckout;
  }
}

window.startCheckout = startCheckout;
window.openBillingPortal = openBillingPortal;
window.closeUpgradeModal = closeUpgradeModal;
window.handlePlanClick = handlePlanClick;

function detectLang() {
  const stored = localStorage.getItem('lang');
  if (stored) return stored;
  const nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
  return nav.startsWith('en') ? 'en' : 'fi';
}

function detectTheme() {
  return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
}

const DEFAULT_SERVICE_NAME = detectLang() === 'en' ? 'Hourly work' : 'Tuntityö';

export function defaultCfg() {
  return {
    // Tax country — everyone is 'FI' for now, no selection UI yet. Groundwork
    // for eventually offering other countries' VAT rules/invoice conventions
    // as their own profile instead of forking the app; existing orgs with no
    // saved value fall back to this default (see loadFromFirestore()'s
    // Object.assign onto defaultCfg()), so this needs no migration.
    country: 'FI',
    hourly: 50, kmRate: 0.57, recurring: [], company: '', address: '', phone: '', email: '', ytunnus: '', tilinumero: '', rounding: 15, minRounding: 0, vat: null, vatZeroReason: null, showTilinumero: true, showErapaiva: true, showViitenumero: false,
    services: [{ id: 1, name: DEFAULT_SERVICE_NAME, rate: 50 }], hideRate: false,
  };
}

export const state = {
  uid: null, orgId: null, accountName: '', accountPhotoURL: '',
  timerRaf: null, startTime: null, elapsedMs: 0,
  clockState: 'idle', clockInDate: null, activeCustomerId: null, activeServiceId: null,
  entries: [], invoices: [], expenses: [], customers: [], eId: 0, iId: 0, eExpId: 0, cId: 0,
  cfg: defaultCfg(),
  configSaveTimer: null,
  editingEntryId: null, editingInvId: null,
  pendingRecurring: null, pending: null,
  deferredPrompt: null, filterCustomers: new Set(),
  lang: detectLang(),
  theme: detectTheme(),
  orgPlan: 'free', orgSubStatus: 'none', orgPeriodEnd: null,
  orgLifetimeEntryCount: 0, orgLifetimeInvoiceCount: 0,
  orgOwnerId: null, orgScheduledDeletionAt: null,
};
export const STILL_IMG = 'images/background2.jpg';
export const ANIM_GIF  = 'images/background3.gif';

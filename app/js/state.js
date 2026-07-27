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
    hourly: 50, kmRate: 0.57, customers: [], recurring: [], company: '', address: '', phone: '', email: '', ytunnus: '', tilinumero: '', rounding: 15, minRounding: 0, vat: 0, showTilinumero: true, showErapaiva: true, showViitenumero: false,
    services: [{ id: 1, name: DEFAULT_SERVICE_NAME, rate: 50 }], hideRate: false,
  };
}

export const state = {
  uid: null, orgId: null, accountName: '', accountPhotoURL: '',
  timerRaf: null, startTime: null, elapsedMs: 0,
  clockState: 'idle', clockInDate: null, activeCustomer: null, activeServiceId: null,
  entries: [], invoices: [], expenses: [], eId: 0, iId: 0, eExpId: 0,
  cfg: defaultCfg(),
  saveTimer: null,
  editingEntryId: null, editingInvId: null,
  pendingRecurring: null, pending: null,
  deferredPrompt: null, filterCustomers: new Set(),
  lang: detectLang(),
  theme: detectTheme(),
  orgPlan: 'free', orgSubStatus: 'none', orgPeriodEnd: null,
  orgLifetimeEntryCount: 0, orgLifetimeInvoiceCount: 0,
};
export const STILL_IMG = 'images/background2.jpg';
export const ANIM_GIF  = 'images/background3.gif';

const DEFAULT_SERVICE_NAME = (localStorage.getItem('lang') || 'fi') === 'en' ? 'Hourly work' : 'Tuntityö';

export function defaultCfg() {
  return {
    hourly: 50, kmRate: 0.57, customers: [], recurring: [], company: '', address: '', phone: '', email: '', ytunnus: '', tilinumero: '', rounding: 15, vat: 0, showTilinumero: true, showErapaiva: true, showViitenumero: false,
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
  lang: localStorage.getItem('lang') || 'fi',
};
export const STILL_IMG = 'images/background2.jpg';
export const ANIM_GIF  = 'images/background3.gif';

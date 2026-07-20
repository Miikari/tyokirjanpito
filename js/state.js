export const state = {
  uid: null, orgId: null, accountName: '', accountPhotoURL: '',
  timerRaf: null, startTime: null, elapsedMs: 0,
  clockState: 'idle', clockInDate: null, activeCustomer: null,
  entries: [], invoices: [], expenses: [], eId: 0, iId: 0, eExpId: 0,
  cfg: { hourly: 50, kmRate: 0.57, customers: [], recurring: [], company: '', address: '', phone: '', email: '', ytunnus: '', tilinumero: '', rounding: 15, vat: 0, showTilinumero: true, showErapaiva: true, showViitenumero: false },
  saveTimer: null,
  editingEntryId: null, editingInvId: null,
  pendingRecurring: null, pending: null,
  deferredPrompt: null, filterCustomer: null,
  lang: localStorage.getItem('lang') || 'fi',
};
export const STILL_IMG = 'images/background2.jpg';
export const ANIM_GIF  = 'images/background3.gif';

let uid = null;

let timerRaf = null, startTime = null, elapsedMs = 0;
let state = 'idle', clockInDate = null, activeCustomer = null;
let entries = [], invoices = [], eId = 0, iId = 0;
let cfg = { hourly: 50, customers: [], recurring: [], company: '', address: '', phone: '', email: '', ytunnus: '', tilinumero: '', rounding: 15, vat: 0, showTilinumero: true, showErapaiva: true, showViitenumero: false };
let saveTimer = null;
let editingEntryId = null;
let editingInvId = null;
let pendingRecurring = null;
let pending = null;
let deferredPrompt = null;
let filterCustomer = null;
let lang = localStorage.getItem('lang') || 'fi';

const STILL_IMG = 'images/background2.jpg';
const ANIM_GIF  = 'images/background3.gif';

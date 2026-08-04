import { state } from './state.js';
import { t } from './i18n.js';
import { fmtDate, todayLocalStr } from './utils.js';
import { toast, updateClockBg } from './ui.js';
import { initClockRate, renderMainBtns, renderPills, setBadge, setTimerText, syncSelectLabel, tick } from './clock.js';
import { renderAllSelects, renderCustChips } from './customers.js';
import { renderEntries } from './entries.js';
import { renderServiceSelects } from './settings.js';

// ── Collection refs ─────────────────────────────────────────────────────
// Every org's data now lives in its own per-entity subcollection instead of
// one whole-blob doc at orgs/{orgId}/data/main — reads/writes below always
// target a single document, never the whole org's data at once.
function orgRef()      { return db.collection('orgs').doc(state.orgId); }
function customersCol() { return orgRef().collection('customers'); }
function entriesCol()   { return orgRef().collection('entries'); }
function invoicesCol()  { return orgRef().collection('invoices'); }
function expensesCol()  { return orgRef().collection('expenses'); }
function configRef()    { return orgRef().collection('settings').doc('config'); }

// ── Sequential per-org ID counters ──────────────────────────────────────
// Invoice IDs feed calcViitenumero() (the printed payment reference number)
// so they must stay small sequential integers, not random Firestore doc
// IDs — a transaction on the shared config doc keeps them unique even when
// two devices create an entry/invoice/expense/customer at the same time.
const COUNTER_FIELD = { entry: 'eId', invoice: 'iId', expense: 'eExpId', customer: 'cId' };

export async function nextId(kind) {
  const field = COUNTER_FIELD[kind];
  const value = await db.runTransaction(async tx => {
    const snap = await tx.get(configRef());
    const current = (snap.exists && snap.data()[field]) || 0;
    const next = current + 1;
    tx.set(configRef(), { [field]: next }, { merge: true });
    return next;
  });
  state[field] = value;
  return value;
}

// ── Entries ──────────────────────────────────────────────────────────────
export async function createEntry(entry) {
  await entriesCol().doc(String(entry.id)).set(entry);
}
export async function updateEntry(id, patch) {
  await entriesCol().doc(String(id)).set(patch, { merge: true });
}
export async function deleteEntryDoc(id) {
  await entriesCol().doc(String(id)).delete();
}

// ── Expenses ─────────────────────────────────────────────────────────────
export async function createExpense(expense) {
  await expensesCol().doc(String(expense.id)).set(expense);
}
export async function deleteExpenseDoc(id) {
  await expensesCol().doc(String(id)).delete();
}

// ── Customers ────────────────────────────────────────────────────────────
export async function createCustomer(customer) {
  await customersCol().doc(String(customer.id)).set(customer);
}
export async function updateCustomer(id, patch) {
  await customersCol().doc(String(id)).set(patch, { merge: true });
}

// ── Invoices ─────────────────────────────────────────────────────────────
export async function updateInvoiceDoc(id, patch) {
  await invoicesCol().doc(String(id)).set(patch, { merge: true });
}

// Finalizing an invoice touches the new invoice doc plus every entry/expense
// doc it consumes — bundled into one atomic batch so a mid-flight failure
// can never leave entries marked invoiced without the invoice existing (or
// vice versa).
export async function finalizeInvoiceBatch(invoice, entryIds, expenseIds) {
  const batch = db.batch();
  batch.set(invoicesCol().doc(String(invoice.id)), invoice);
  entryIds.forEach(id => batch.set(entriesCol().doc(String(id)), { invoiced: true, selected: false }, { merge: true }));
  expenseIds.forEach(id => batch.set(expensesCol().doc(String(id)), { invoiced: true, selected: false }, { merge: true }));
  await batch.commit();
}

// Deleting a customer also deletes their still-open (not yet invoiced)
// entries, matching the pre-migration behaviour in customers.js.
export async function deleteCustomerBatch(customerId, openEntryIds) {
  const batch = db.batch();
  batch.delete(customersCol().doc(String(customerId)));
  openEntryIds.forEach(id => batch.delete(entriesCol().doc(String(id))));
  await batch.commit();
}

// ── Settings/config ──────────────────────────────────────────────────────
// cfg is small (company info, VAT, rounding, services, recurring charges) —
// unlike entries/invoices/expenses/customers it stays a single document,
// merge-written on an 800ms debounce like before. This never touches the
// eId/iId/eExpId/cId counter fields living on the same document, since
// those are only ever written via nextId()'s transaction.
export function saveConfig() {
  if (!state.orgId) return;
  clearTimeout(state.configSaveTimer);
  state.configSaveTimer = setTimeout(async () => {
    try { await configRef().set(state.cfg, { merge: true }); }
    catch (e) { toast(t('tallennusVirhe')); }
  }, 800);
}

// ── Load ─────────────────────────────────────────────────────────────────
export async function loadFromFirestore() {
  try {
    const [configDoc, customersSnap, entriesSnap, invoicesSnap, expensesSnap] = await Promise.all([
      configRef().get(),
      customersCol().get(),
      entriesCol().orderBy('id', 'desc').get(),
      invoicesCol().orderBy('id', 'desc').get(),
      expensesCol().orderBy('id', 'desc').get(),
    ]);

    if (configDoc.exists) {
      const { eId, iId, eExpId, cId, ...cfgFields } = configDoc.data();
      Object.assign(state.cfg, cfgFields);
      if (eId)    state.eId    = eId;
      if (iId)    state.iId    = iId;
      if (eExpId) state.eExpId = eExpId;
      if (cId)    state.cId    = cId;
    }
    state.customers = customersSnap.docs.map(d => d.data());
    state.entries   = entriesSnap.docs.map(d => d.data());
    state.invoices  = invoicesSnap.docs.map(d => d.data());
    state.expenses  = expensesSnap.docs.map(d => d.data());

    if (!state.cfg.services || !state.cfg.services.length) {
      state.cfg.services = [{ id: 1, name: state.lang === 'en' ? 'Hourly work' : 'Tuntityö', rate: state.cfg.hourly ?? 50 }];
    }
  } catch (e) { toast(t('latausVirhe') + e.message); }

  renderServiceSelects();
  document.getElementById('m-date').value = todayLocalStr();
  document.getElementById('exp-date').value = todayLocalStr();
  window.updateExpenseKindOptions?.();
  renderAllSelects(); renderCustChips(); renderPills(); renderEntries();
  window.updateInvoiceBadge?.();

  try {
    const activeDoc = await db.collection('users').doc(state.uid).collection('data').doc('active').get();
    if (activeDoc.exists) {
      const a = activeDoc.data();
      state.startTime = a.startTime;
      state.clockInDate = new Date(a.clockInDate);
      state.activeCustomerId = a.customerId ?? null;
      const matchedService = state.cfg.services.find(s => s.name === a.service);
      state.activeServiceId = matchedService ? matchedService.id : state.cfg.services[0]?.id ?? null;
      const svcSel = document.getElementById('service-select');
      if (svcSel) svcSel.value = state.activeServiceId;
      syncSelectLabel('service-select', 'service-select-label');
      const savedRate = a.rate || state.cfg.hourly;
      document.getElementById('clock-rate-input').value = savedRate;
      document.getElementById('clock-rate-val').textContent = savedRate.toFixed(2).replace('.', ',') + ' €/h';
      state.elapsedMs = 0;
      state.clockState = 'running';
      state.timerRaf = requestAnimationFrame(tick);
      const th = state.clockInDate.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
      document.getElementById('timer-sub').textContent = fmtDate(state.clockInDate) + ' — aloitettu ' + th;
      setBadge('running', '● Töissä'); renderMainBtns(); renderPills();
      updateClockBg();
    }
  } catch (e) { toast(t('latausVirhe')); }
}

let activeUnsub = null;

export function listenActiveState() {
  if (activeUnsub) { activeUnsub(); activeUnsub = null; }
  if (!state.uid) return;

  activeUnsub = db.collection('users').doc(state.uid).collection('data').doc('active')
    .onSnapshot(async doc => {
      if (!state.uid) return;
      if (doc.exists) {
        const a = doc.data();
        if (state.clockState !== 'idle' && state.startTime === a.startTime) return;
        state.startTime = a.startTime;
        state.clockInDate = new Date(a.clockInDate);
        state.activeCustomerId = a.customerId ?? null;
        const matchedService = state.cfg.services.find(s => s.name === a.service);
        state.activeServiceId = matchedService ? matchedService.id : state.cfg.services[0]?.id ?? null;
        const svcSel = document.getElementById('service-select');
        if (svcSel) svcSel.value = state.activeServiceId;
        syncSelectLabel('service-select', 'service-select-label');
        const savedRate = a.rate || state.cfg.hourly;
        document.getElementById('clock-rate-input').value = savedRate;
        document.getElementById('clock-rate-val').textContent = savedRate.toFixed(2).replace('.', ',') + ' €/h';
        state.elapsedMs = 0;
        if (state.clockState !== 'running') {
          cancelAnimationFrame(state.timerRaf);
          state.clockState = 'running';
          state.timerRaf = requestAnimationFrame(tick);
        }
        const th = state.clockInDate.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('timer-sub').textContent = fmtDate(state.clockInDate) + ' — aloitettu ' + th;
        setBadge('running', '● Töissä'); renderMainBtns(); renderPills();
        updateClockBg();
      } else if (state.clockState !== 'idle') {
        cancelAnimationFrame(state.timerRaf);
        state.clockState = 'idle'; state.elapsedMs = 0; state.startTime = null;
        state.clockInDate = null; state.activeCustomerId = null;
        setTimerText('00:00:00');
        document.getElementById('timer-sub').textContent = '—';
        setBadge('idle', ''); renderMainBtns(); renderPills();
        updateClockBg();
        toast('Kello pysäytetty toisella laitteella');
        await loadFromFirestore();
      }
    }, () => {});
}

export function unlistenActiveState() {
  if (activeUnsub) { activeUnsub(); activeUnsub = null; }
}

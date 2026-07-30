import { state } from './state.js';
import { t } from './i18n.js';
import { fmtDate, fmtDur, fmtEur, fmtShort, esc, roundDuration } from './utils.js';
import { toast, showConfirm } from './ui.js';
import { nextId, createEntry, updateEntry, deleteEntryDoc, createExpense, deleteExpenseDoc } from './storage.js';
import { isPro, showUpgradeModal, incrementEntryCount } from './billing.js';
import { customerName } from './customers.js';


// Returns true if the entry was added, false if blocked by the free-tier
// limit — callers must check this, since a caller mid-flow (e.g. clocking
// out of a running timer) must not discard already-tracked time on a block.
export async function addEntry(date, secs, customerId, src, notes = '', rate = null, km = 0, service = null) {
  if (!isPro() && state.orgLifetimeEntryCount >= 50) {
    toast(t('freeLimitEntries'));
    showUpgradeModal();
    return false;
  }
  const entryRate = (rate !== null && !isNaN(rate) && rate >= 0) ? rate : state.cfg.hourly;
  const id = await nextId('entry');
  const entry = { id, date: new Date(date).toISOString(), secs, customerId: customerId || null, src, notes, rate: entryRate, service: service || null, km: km || 0, selected: false, invoiced: false };
  state.entries.unshift(entry);
  await createEntry(entry);
  incrementEntryCount();
  return true;
}

function selManualService(id) {
  const svc = state.cfg.services.find(s => s.id === parseInt(id, 10));
  if (svc) document.getElementById('m-rate').value = svc.rate;
}

async function addManual() {
  const custVal = document.getElementById('m-customer').value;
  if (!custVal || custVal === '—') { toast(t('selectCustomer')); return; }
  const customerId = parseInt(custVal, 10);
  const d = document.getElementById('m-date').value;
  const h = parseInt(document.getElementById('m-h').value) || 0;
  const m = parseInt(document.getElementById('m-m').value) || 0;
  const rawTotal = h * 3600 + m * 60;
  if (rawTotal < 1) { toast(t('enterTime')); return; }
  const total = roundDuration(rawTotal, state.cfg);
  const notes = document.getElementById('m-notes').value;
  const rateVal = parseFloat(document.getElementById('m-rate').value);
  const rate = (!isNaN(rateVal) && rateVal >= 0) ? rateVal : state.cfg.hourly;
  const svc = state.cfg.services.find(s => s.id === parseInt(document.getElementById('m-service').value, 10));
  if (total < 1) { toast(t('enterTime')); return; }
  const ok = await addEntry(d ? new Date(d + 'T12:00:00') : new Date(), total, customerId, 'manuaalinen', notes, rate, 0, svc ? svc.name : null);
  if (!ok) return;
  document.getElementById('m-h').value = '';
  document.getElementById('m-m').value = '';
  document.getElementById('m-notes').value = '';
  renderEntries(); toast(t('entryAdded'));
}

function toggleEntry(id) {
  const e = state.entries.find(x => x.id === id);
  if (e && !e.invoiced) e.selected = !e.selected;
  const all = state.entries.filter(e => !e.invoiced);
  const sel = all.filter(e => e.selected);
  document.getElementById('s-sel').textContent = sel.length;
}

function matchesFilter(e) {
  return !state.filterCustomers.size || (e.customerId != null && state.filterCustomers.has(e.customerId));
}

function selectAll() {
  const u = state.entries.filter(e => !e.invoiced && matchesFilter(e));
  const all = u.length && u.every(e => e.selected);
  u.forEach(e => e.selected = !all);
  state.expenses.filter(e => !e.invoiced && matchesFilter(e)).forEach(e => e.selected = !all);
  renderEntries();
}

function setFilter(id) {
  if (state.filterCustomers.has(id)) {
    state.filterCustomers.delete(id);
    state.entries.filter(e => !e.invoiced && e.customerId === id).forEach(e => e.selected = false);
    state.expenses.filter(e => !e.invoiced && e.customerId === id).forEach(e => e.selected = false);
  } else {
    state.filterCustomers.add(id);
    state.entries.filter(e => !e.invoiced && e.customerId === id).forEach(e => e.selected = true);
    state.expenses.filter(e => !e.invoiced && e.customerId === id).forEach(e => e.selected = true);
  }
  renderEntries();
}

function renderFilterPills() {
  const customerIds = [...new Set(state.entries.filter(e => !e.invoiced && e.customerId != null).map(e => e.customerId))];
  const el = document.getElementById('filter-pills');
  if (!el) return;
  const wrap = document.getElementById('filter-pills-wrap');
  if (wrap) wrap.style.display = customerIds.length ? 'block' : 'none';

  if (!customerIds.length) { el.innerHTML = ''; return; }
  el.innerHTML = customerIds.map(id => {
    const isActive = state.filterCustomers.has(id);
    return `<div class="pill ${isActive ? 'active' : ''}"
      style="background:${isActive ? 'var(--blue)' : 'var(--surface)'};color:${isActive ? '#fff' : 'var(--text2)'};border-color:${isActive ? 'var(--blue)' : 'var(--border2)'};"
      onclick="setFilter(${id})">${esc(customerName(id) || '—')}</div>`;
  }).join('');
}

export function renderEntries() {
  const list = document.getElementById('entries-list');
  const active = state.entries.filter(e => !e.invoiced && matchesFilter(e));
  const all = state.entries.filter(e => !e.invoiced);
  const sel = all.filter(e => e.selected);
  document.getElementById('s-count').textContent = active.length;
  document.getElementById('s-sel').textContent = sel.length;
  document.getElementById('s-total').textContent = fmtShort(all.reduce((a, e) => a + e.secs, 0));
  document.getElementById('s-val').textContent = fmtEur(all.reduce((a, e) => a + (e.secs / 3600) * (e.rate ?? state.cfg.hourly), 0));
  renderFilterPills();
  if (!active.length) {
    const filterLabel = [...state.filterCustomers].map(id => customerName(id) || '—').join(', ');
    list.innerHTML = `<div class="empty">${state.filterCustomers.size ? t('noEntriesFor') + ' ' + esc(filterLabel) : t('noEntries')}<br><br>${!state.filterCustomers.size ? t('loginFirst') : ''}</div>`;
    return;
  }
  list.innerHTML = active.map(e => `
    <div class="entry">
      <input type="checkbox" class="ecb" ${e.selected ? 'checked' : ''} onchange="toggleEntry(${e.id})">
      <div class="entry-info">
        <div class="entry-meta">${fmtDate(e.date)}</div>
        <div class="entry-dur">${fmtDur(e.secs)}</div>
        ${e.notes ? `<div style="font-size:12px;color:var(--text2);margin-top:3px;">📝 ${esc(e.notes)}</div>` : ''}
        ${e.km ? `<div style="font-size:12px;color:var(--text2);margin-top:2px;">🚗 ${e.km} km</div>` : ''}
      </div>
      <div class="entry-right">
        ${e.customerId != null ? `<span class="tag tag-cust">${esc(customerName(e.customerId) || '—')}</span>` : ''}
        ${e.service ? `<span class="tag tag-svc">${esc(e.service)}</span>` : ''}
        <span class="entry-eur">${fmtEur((e.secs / 3600) * (e.rate ?? state.cfg.hourly))}</span>
        <span class="tag tag-open">${t('open') || 'Avoin'}</span>
      </div>
      <button onclick="openEditEntry(${e.id})" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--text2);flex-shrink:0;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </div>`).join('');
  renderExpenses();
}

// ── EDIT ENTRY ──
function openEditEntry(id) {
  const e = state.entries.find(x => x.id === id);
  if (!e) return;
  state.editingEntryId = id;
  const d = new Date(e.date);
  document.getElementById('edit-date').value = d.toISOString().slice(0, 10);
  document.getElementById('edit-h').value = Math.floor(e.secs / 3600);
  document.getElementById('edit-m').value = Math.floor((e.secs % 3600) / 60);
  document.getElementById('edit-notes').value = e.notes || '';
  document.getElementById('edit-rate').value = e.rate ?? state.cfg.hourly;
  const opts = [`<option value="—">— ${t('noCustomer')} —</option>`,
    ...state.customers.map(c => `<option value="${c.id}" ${e.customerId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`)].join('');
  document.getElementById('edit-customer').innerHTML = opts;
  const svcOpts = [`<option value="—">— ${t('noService')} —</option>`,
    ...state.cfg.services.map(s => `<option value="${s.id}" ${e.service === s.name ? 'selected' : ''}>${esc(s.name)}</option>`)].join('');
  document.getElementById('edit-service').innerHTML = svcOpts;
  document.getElementById('modal-edit').classList.add('open');
}

function selEditService(id) {
  const svc = state.cfg.services.find(s => s.id === parseInt(id, 10));
  if (svc) document.getElementById('edit-rate').value = svc.rate;
}

async function saveEditEntry() {
  const e = state.entries.find(x => x.id === state.editingEntryId);
  if (!e) return;
  const d = document.getElementById('edit-date').value;
  const h = parseInt(document.getElementById('edit-h').value) || 0;
  const m = parseInt(document.getElementById('edit-m').value) || 0;
  const custVal = document.getElementById('edit-customer').value;
  const notes = document.getElementById('edit-notes').value.trim();
  const total = h * 3600 + m * 60;
  if (total < 1) { toast(t('enterTime')); return; }
  e.date = d ? new Date(d + 'T12:00:00').toISOString() : e.date;
  e.secs = total;
  e.customerId = custVal === '—' ? null : parseInt(custVal, 10);
  e.notes = notes;
  const svcId = document.getElementById('edit-service').value;
  const svc = state.cfg.services.find(s => s.id === parseInt(svcId, 10));
  e.service = svc ? svc.name : null;
  const rateVal = parseFloat(document.getElementById('edit-rate').value);
  e.rate = (!isNaN(rateVal) && rateVal >= 0) ? rateVal : state.cfg.hourly;
  closeEditModal();
  await updateEntry(e.id, { date: e.date, secs: e.secs, customerId: e.customerId, notes: e.notes, service: e.service, rate: e.rate });
  renderEntries(); toast(t('entryUpdated'));
}

function deleteEntry() {
  showConfirm(
    t('deleteEntry'),
    t('deleteEntryConfirm'),
    async () => {
      const id = state.editingEntryId;
      state.entries = state.entries.filter(x => x.id !== id);
      closeEditModal();
      await deleteEntryDoc(id);
      renderEntries(); toast(t('entryRemoved'));
    }
  );
}

function closeEditModal() {
  document.getElementById('modal-edit').classList.remove('open');
  state.editingEntryId = null;
}

// ── EXPENSES ──
export async function addExpense() {
  const desc = document.getElementById('exp-desc').value.trim();
  const amount = parseFloat(document.getElementById('exp-amount').value);
  const vat = parseFloat(document.getElementById('exp-vat').value) || 0;
  const custVal = document.getElementById('exp-customer').value;
  if (!desc) { toast(t('expenseDescRequired')); return; }
  if (isNaN(amount) || amount === 0) { toast(t('enterAmount')); return; }
  const id = await nextId('expense');
  const expense = {
    id,
    date: new Date().toISOString(),
    description: desc,
    amount,
    vat,
    vatAmount: amount * vat / 100,
    customerId: custVal === '—' ? null : parseInt(custVal, 10),
    selected: false,
    invoiced: false,
  };
  state.expenses.unshift(expense);
  await createExpense(expense);
  document.getElementById('exp-desc').value = '';
  document.getElementById('exp-amount').value = '';
  renderExpenses(); toast(t('expenseAdded'));
}

export function toggleExpense(id) {
  const e = state.expenses.find(x => x.id === id);
  if (e && !e.invoiced) e.selected = !e.selected;
}

async function deleteExpense(id) {
  state.expenses = state.expenses.filter(x => x.id !== id);
  await deleteExpenseDoc(id);
  renderExpenses(); toast(t('expenseRemoved'));
}

export function renderExpenses() {
  const vatSel = document.getElementById('exp-vat');
  if (vatSel && !vatSel.dataset.defaulted) {
    vatSel.value = state.cfg.vat ?? '0';
    vatSel.dataset.defaulted = '1';
  }
  const kirjEl = document.getElementById('kirjanpito-expenses');
  if (!kirjEl) return;
  const uninv = state.expenses.filter(e => !e.invoiced);
  if (!uninv.length) { kirjEl.innerHTML = ''; return; }
  kirjEl.innerHTML = `<div class="card-label" style="margin-top:6px;margin-bottom:10px;">${t('expenses')}</div>` +
    uninv.map(e => `
      <div class="entry">
        <input type="checkbox" class="ecb" ${e.selected ? 'checked' : ''} onchange="toggleExpense(${e.id})">
        <div class="entry-info">
          <div class="entry-meta">${fmtDate(e.date)}</div>
          <div class="entry-dur" style="font-size:15px;">${esc(e.description)}</div>
        </div>
        <div class="entry-right">
          ${e.customerId != null ? `<span class="tag tag-cust">${esc(customerName(e.customerId) || '—')}</span>` : ''}
          <span class="entry-eur">${fmtEur(e.amount)}</span>
          <span class="tag tag-open">${t('open')}</span>
        </div>
        <button onclick="deleteExpense(${e.id})" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--text2);flex-shrink:0;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>`).join('');
}

window.addManual = addManual;
window.selManualService = selManualService;
window.selectAll = selectAll;
window.setFilter = setFilter;
window.openEditEntry = openEditEntry;
window.saveEditEntry = saveEditEntry;
window.selEditService = selEditService;
window.deleteEntry = deleteEntry;
window.closeEditModal = closeEditModal;
window.toggleEntry = toggleEntry;
window.addExpense = addExpense;
window.toggleExpense = toggleExpense;
window.deleteExpense = deleteExpense;

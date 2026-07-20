import { state } from './state.js';
import { t } from './i18n.js';
import { fmtDate, fmtDur, fmtEur, fmtShort, esc } from './utils.js';
import { toast, showConfirm } from './ui.js';
import { save } from './storage.js';


export function addEntry(date, secs, customer, src, notes = '', rate = null, km = 0, service = null) {
  const entryRate = (rate !== null && !isNaN(rate) && rate >= 0) ? rate : state.cfg.hourly;
  state.entries.unshift({ id: ++state.eId, date: new Date(date).toISOString(), secs, customer, src, notes, rate: entryRate, service: service || null, km: km || 0, selected: false, invoiced: false });
}

function selManualService(id) {
  const svc = state.cfg.services.find(s => s.id === parseInt(id, 10));
  if (svc) document.getElementById('m-rate').value = svc.rate;
}

function addManual() {
  const cust = document.getElementById('m-customer').value;
  if (!cust || cust === '—') { toast(t('selectCustomer')); return; }
  const d = document.getElementById('m-date').value;
  const h = parseInt(document.getElementById('m-h').value) || 0;
  const m = parseInt(document.getElementById('m-m').value) || 0;
  const rawTotal = h * 3600 + m * 60;
  if (rawTotal < 1) { toast(t('enterTime')); return; }
  const interval = (state.cfg.rounding || 15) * 60;
  const total = state.cfg.rounding === 1 ? rawTotal : Math.ceil(rawTotal / interval) * interval;
  const notes = document.getElementById('m-notes').value;
  const rateVal = parseFloat(document.getElementById('m-rate').value);
  const rate = (!isNaN(rateVal) && rateVal >= 0) ? rateVal : state.cfg.hourly;
  const svc = state.cfg.services.find(s => s.id === parseInt(document.getElementById('m-service').value, 10));
  if (total < 1) { toast(t('enterTime')); return; }
  addEntry(d ? new Date(d + 'T12:00:00') : new Date(), total, cust, 'manuaalinen', notes, rate, 0, svc ? svc.name : null);
  document.getElementById('m-h').value = '';
  document.getElementById('m-m').value = '';
  document.getElementById('m-notes').value = '';
  save(); toast(t('entryAdded'));
}

function toggleEntry(id) {
  const e = state.entries.find(x => x.id === id);
  if (e && !e.invoiced) e.selected = !e.selected;
  const all = state.entries.filter(e => !e.invoiced);
  const sel = all.filter(e => e.selected);
  document.getElementById('s-sel').textContent = sel.length;
}

function matchesFilter(e) {
  return !state.filterCustomers.size || (e.customer && state.filterCustomers.has(e.customer));
}

function selectAll() {
  const u = state.entries.filter(e => !e.invoiced && matchesFilter(e));
  const all = u.length && u.every(e => e.selected);
  u.forEach(e => e.selected = !all);
  renderEntries();
}

function setFilter(c) {
  if (state.filterCustomers.has(c)) {
    state.filterCustomers.delete(c);
    state.entries.filter(e => !e.invoiced && e.customer === c).forEach(e => e.selected = false);
  } else {
    state.filterCustomers.add(c);
    state.entries.filter(e => !e.invoiced && e.customer === c).forEach(e => e.selected = true);
  }
  renderEntries();
}

function renderFilterPills() {
  const customers = [...new Set(state.entries.filter(e => !e.invoiced && e.customer).map(e => e.customer))];
  const el = document.getElementById('filter-pills');
  if (!el) return;
  const wrap = document.getElementById('filter-pills-wrap');
  if (wrap) wrap.style.display = customers.length ? 'block' : 'none';

  const existing = el.querySelectorAll('.pill');
  if (existing.length === customers.length) {
    existing.forEach(pill => {
      const isActive = state.filterCustomers.has(pill.textContent.trim());
      pill.classList.toggle('active', isActive);
      pill.style.background = isActive ? 'var(--blue)' : 'var(--surface)';
      pill.style.color = isActive ? '#fff' : 'var(--text2)';
      pill.style.borderColor = isActive ? 'var(--blue)' : 'var(--border2)';
    });
    return;
  }

  if (!customers.length) { el.innerHTML = ''; return; }
  el.innerHTML = customers.map(c => {
    const isActive = state.filterCustomers.has(c);
    return `<div class="pill ${isActive ? 'active' : ''}"
      style="background:${isActive ? 'var(--blue)' : 'var(--surface)'};color:${isActive ? '#fff' : 'var(--text2)'};border-color:${isActive ? 'var(--blue)' : 'var(--border2)'};"
      onclick="setFilter(${esc(JSON.stringify(c))})">${esc(c)}</div>`;
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
    const filterLabel = [...state.filterCustomers].join(', ');
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
        ${e.customer ? `<span class="tag tag-cust">${esc(e.customer)}</span>` : ''}
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
    ...state.cfg.customers.map(c => `<option value="${esc(c.name)}" ${e.customer === c.name ? 'selected' : ''}>${esc(c.name)}</option>`)].join('');
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

function saveEditEntry() {
  const e = state.entries.find(x => x.id === state.editingEntryId);
  if (!e) return;
  const d = document.getElementById('edit-date').value;
  const h = parseInt(document.getElementById('edit-h').value) || 0;
  const m = parseInt(document.getElementById('edit-m').value) || 0;
  const cust = document.getElementById('edit-customer').value;
  const notes = document.getElementById('edit-notes').value.trim();
  const total = h * 3600 + m * 60;
  if (total < 1) { toast(t('enterTime')); return; }
  e.date = d ? new Date(d + 'T12:00:00').toISOString() : e.date;
  e.secs = total;
  e.customer = cust === '—' ? null : cust;
  e.notes = notes;
  const svcId = document.getElementById('edit-service').value;
  const svc = state.cfg.services.find(s => s.id === parseInt(svcId, 10));
  e.service = svc ? svc.name : null;
  const rateVal = parseFloat(document.getElementById('edit-rate').value);
  e.rate = (!isNaN(rateVal) && rateVal >= 0) ? rateVal : state.cfg.hourly;
  closeEditModal();
  save(); renderEntries(); toast(t('entryUpdated'));
}

function deleteEntry() {
  showConfirm(
    t('deleteEntry'),
    t('deleteEntryConfirm'),
    () => {
      state.entries = state.entries.filter(x => x.id !== state.editingEntryId);
      closeEditModal();
      save(); renderEntries(); toast(t('entryRemoved'));
    }
  );
}

function closeEditModal() {
  document.getElementById('modal-edit').classList.remove('open');
  state.editingEntryId = null;
}

// ── EXPENSES ──
export function addExpense() {
  const desc = document.getElementById('exp-desc').value.trim();
  const amount = parseFloat(document.getElementById('exp-amount').value);
  const cust = document.getElementById('exp-customer').value;
  if (!desc) { toast(t('expenseDescRequired')); return; }
  if (isNaN(amount) || amount <= 0) { toast(t('enterAmount')); return; }
  state.expenses.unshift({
    id: ++state.eExpId,
    date: new Date().toISOString(),
    description: desc,
    amount,
    customer: cust === '—' ? null : cust,
    selected: false,
    invoiced: false,
  });
  document.getElementById('exp-desc').value = '';
  document.getElementById('exp-amount').value = '';
  save(); renderExpenses(); toast(t('expenseAdded'));
}

export function toggleExpense(id) {
  const e = state.expenses.find(x => x.id === id);
  if (e && !e.invoiced) e.selected = !e.selected;
}

function deleteExpense(id) {
  state.expenses = state.expenses.filter(x => x.id !== id);
  save(); renderExpenses(); toast(t('expenseRemoved'));
}

export function renderExpenses() {
  // kello-panel list
  const kelloEl = document.getElementById('exp-list-kello');
  if (kelloEl) {
    const uninv = state.expenses.filter(e => !e.invoiced);
    kelloEl.innerHTML = uninv.length ? uninv.map(e => `
      <div class="exp-row">
        <div class="exp-info">
          <div class="exp-desc">${esc(e.description)}</div>
          <div class="exp-sub">${e.customer ? esc(e.customer) + ' · ' : ''}${fmtEur(e.amount)}</div>
        </div>
        <button onclick="deleteExpense(${e.id})" style="background:none;border:none;cursor:pointer;color:var(--text3);padding:4px;flex-shrink:0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>`).join('') : '';
  }
  // kirjanpito-panel list
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
          ${e.customer ? `<span class="tag tag-cust">${esc(e.customer)}</span>` : ''}
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

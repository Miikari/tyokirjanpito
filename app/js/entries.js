import { state } from './state.js';
import { t } from './i18n.js';
import { fmtDate, fmtDur, fmtEur, fmtShort, esc, roundDuration, localDateStr } from './utils.js';
import { toast, centerNotice, showConfirm } from './ui.js';
import { nextId, createEntry, updateEntry, deleteEntryDoc, createExpense, deleteExpenseDoc } from './storage.js';
import { isPro, showUpgradeModal, incrementEntryCount } from './billing.js';
import { customerName, customerById, ADD_NEW_VALUE } from './customers.js';


// Returns true if the entry was added, false if blocked by the free-tier
// limit — callers must check this, since a caller mid-flow (e.g. clocking
// out of a running timer) must not discard already-tracked time on a block.
export async function addEntry(date, secs, customerId, src, notes = '', rate = null, km = 0, service = null) {
  if (!isPro() && state.orgLifetimeEntryCount >= 100) {
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
  const btn = document.getElementById('manual-add-btn');
  if (btn.disabled) return; // guards the double-click race — see saveCustomerModal() for the same issue
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

  const doSave = () => saveManualEntry(btn, d, total, customerId, notes, rate, svc);
  if (total >= 86400 && should24hWarn()) { show24hWarning(doSave); return; }
  await doSave();
}

async function saveManualEntry(btn, d, total, customerId, notes, rate, svc) {
  const origLabel = btn.textContent;
  btn.disabled = true; btn.textContent = t('saving');
  try {
    const ok = await addEntry(d ? new Date(d + 'T12:00:00') : new Date(), total, customerId, 'manuaalinen', notes, rate, 0, svc ? svc.name : null);
    if (!ok) return;
    document.getElementById('m-h').value = '';
    document.getElementById('m-m').value = '';
    document.getElementById('m-notes').value = '';
    renderEntries(); centerNotice(t('entryAddedForCustomer') + customerName(customerId));
  } finally {
    btn.disabled = false; btn.textContent = origLabel;
  }
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

// Customer filter is exclusive, not multi-select: picking a customer always
// clears every current selection first — not just selections tied to a
// customer that was itself an active filter, but also any stray manual
// checkbox tick made outside the filter entirely — so nothing can silently
// carry over into whatever gets invoiced next (see project memory on this bug).
function clearFilterSelection() {
  state.entries.forEach(e => { if (!e.invoiced) e.selected = false; });
  state.expenses.forEach(e => { if (!e.invoiced) e.selected = false; });
  state.filterCustomers.clear();
}

function applyFilterSelection(id) {
  state.filterCustomers.add(id);
  state.entries.filter(e => !e.invoiced && e.customerId === id).forEach(e => e.selected = true);
  state.expenses.filter(e => !e.invoiced && e.customerId === id).forEach(e => e.selected = true);
}

// Pill click: toggling the already-active pill clears the filter.
function setFilter(id) {
  const wasSoleFilter = state.filterCustomers.size === 1 && state.filterCustomers.has(id);
  clearFilterSelection();
  if (!wasSoleFilter) applyFilterSelection(id);
  renderEntries();
}

// Dropdown change (5+ customers): value is explicit, '' means "no filter".
function setFilterFromSelect(value) {
  clearFilterSelection();
  if (value) applyFilterSelection(parseInt(value, 10));
  renderEntries();
}

function renderFilterPills() {
  const customerIds = [...new Set(state.entries.filter(e => !e.invoiced && e.customerId != null).map(e => e.customerId))];
  const el = document.getElementById('filter-pills');
  if (!el) return;
  const wrap = document.getElementById('filter-pills-wrap');
  if (wrap) wrap.style.display = customerIds.length ? 'block' : 'none';

  if (!customerIds.length) { el.innerHTML = ''; return; }

  // Too many pills to scan comfortably — a dropdown is faster to use once
  // there are several customers.
  if (customerIds.length >= 5) {
    const activeId = state.filterCustomers.size === 1 ? [...state.filterCustomers][0] : null;
    const sorted = [...customerIds].sort((a, b) => (customerName(a) || '').localeCompare(customerName(b) || '', 'fi', { sensitivity: 'base' }));
    el.innerHTML = `<select onchange="setFilterFromSelect(this.value)" style="width:100%;padding:9px 12px;border-radius:var(--r-sm);border:1.5px solid var(--border2);background:var(--bg);color:var(--text);font-size:14px;">
      <option value="">${t('allCustomers')}</option>
      ${sorted.map(id => `<option value="${id}"${activeId === id ? ' selected' : ''}>${esc(customerName(id) || '—')}</option>`).join('')}
    </select>`;
    return;
  }

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
    renderExpenses();
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
    ...state.customers.map(c => `<option value="${c.id}" ${e.customerId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`),
    `<option value="${ADD_NEW_VALUE}">${t('addCustomer')}</option>`].join('');
  document.getElementById('edit-customer').innerHTML = opts;
  document.getElementById('edit-customer').dataset.prevValue = e.customerId ?? '—';
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
  const svcId = document.getElementById('edit-service').value;
  const svc = state.cfg.services.find(s => s.id === parseInt(svcId, 10));
  const rateVal = parseFloat(document.getElementById('edit-rate').value);

  const doSave = () => finishSaveEditEntry(e, d, total, custVal, notes, svc, rateVal);
  if (total >= 86400 && should24hWarn()) { show24hWarning(doSave); return; }
  await doSave();
}

async function finishSaveEditEntry(e, d, total, custVal, notes, svc, rateVal) {
  e.date = d ? new Date(d + 'T12:00:00').toISOString() : e.date;
  e.secs = total;
  e.customerId = custVal === '—' ? null : parseInt(custVal, 10);
  e.notes = notes;
  e.service = svc ? svc.name : null;
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
// #exp-desc doubles as either the free-text description, the km count, or
// (for perdiem) an optional note — depending on the selected kind. For
// kind==='km', #exp-amount switches meaning too: it's the €/km rate
// (prefilled from settings, editable), not the total — the total is
// km × rate, computed in addExpense() and written into the description as
// a breakdown. km/perdiem also reveal an end-date field so a whole multi-day
// trip can be logged in one go instead of one row per day by hand.
function onExpenseKindChange() {
  const kind = document.getElementById('exp-kind').value;
  const descInput = document.getElementById('exp-desc');
  const descLabel = document.getElementById('exp-desc-label');
  const amountInput = document.getElementById('exp-amount');
  const amountLabel = document.getElementById('exp-amount-label');
  const multiDayRow = document.getElementById('exp-multi-day-row');
  const multiDayCheckbox = document.getElementById('exp-multi-day');
  const perdiemTimeRow = document.getElementById('exp-perdiem-time-row');
  descInput.value = '';
  multiDayRow.style.display = (kind === 'km' || kind === 'perdiem') ? '' : 'none';
  multiDayCheckbox.checked = false;
  perdiemTimeRow.style.display = kind === 'perdiem' ? 'flex' : 'none';
  onExpenseMultiDayChange();
  if (kind === 'km') {
    descLabel.textContent = t('kmCount');
    descInput.type = 'number';
    descInput.min = '0'; descInput.step = '1';
    descInput.placeholder = '0';
    amountLabel.textContent = t('kmReimbursementRate');
    amountInput.type = 'number';
    amountInput.readOnly = false;
    amountInput.value = (state.cfg.kmRate ?? 0.57).toFixed(2);
  } else if (kind === 'perdiem') {
    descLabel.textContent = t('expenseDescOptional');
    descInput.type = 'text';
    descInput.removeAttribute('min'); descInput.removeAttribute('step');
    descInput.placeholder = t('expenseDescPlaceholder');
    amountLabel.textContent = t('perdiemDaysCountLabel');
    amountInput.type = 'text';
    amountInput.readOnly = true;
    refreshExpensePerdiemPreview();
  } else {
    descLabel.textContent = t('expenseDesc');
    descInput.type = 'text';
    descInput.removeAttribute('min'); descInput.removeAttribute('step');
    descInput.placeholder = 'esim. Matkakulut, materiaali...';
    amountLabel.textContent = t('expenseAmount');
    amountInput.type = 'number';
    amountInput.readOnly = false;
    amountInput.value = '';
  }
}

// The end-date field only makes sense once "mark several at once" is
// checked — otherwise the form should look exactly like the pre-multi-day
// single-entry flow (single date, single km/perdiem row).
function onExpenseMultiDayChange() {
  const checked = document.getElementById('exp-multi-day').checked;
  const endDateRow = document.getElementById('exp-end-date-row');
  endDateRow.style.display = checked ? '' : 'none';
  if (!checked) document.getElementById('exp-end-date').value = '';
  refreshExpensePerdiemPreview();
}

// Live "vuorokausien määrä" preview shown where Summa normally sits — the
// perdiem euro amount isn't known until submit (it depends on which of the
// configured full/half rates apply), so this just previews how many
// matkavuorokausia the current date/time inputs will produce.
function refreshExpensePerdiemPreview() {
  const amountInput = document.getElementById('exp-amount');
  if (document.getElementById('exp-kind').value !== 'perdiem') return;
  const dateVal = document.getElementById('exp-date').value;
  const endDateVal = document.getElementById('exp-end-date').value || dateVal;
  if (!dateVal || endDateVal < dateVal) { amountInput.value = ''; return; }
  const departureTime = document.getElementById('exp-departure-time').value || '00:00';
  const returnTime = document.getElementById('exp-return-time').value || '23:59';
  amountInput.value = classifyPerdiemDays(dateVal, departureTime, endDateVal, returnTime).length;
}

// Hides the km/perdiem <option>s in the kind select for orgs that haven't
// opted into billing that expense type (settings.js toggles) — keeps the
// dropdown uncluttered for freelancers who never use them. Falls back to
// "general" if the currently selected kind just got hidden out from under it.
function updateExpenseKindOptions() {
  const kindSelect = document.getElementById('exp-kind');
  const kmOpt = kindSelect.querySelector('option[value="km"]');
  const perdiemOpt = kindSelect.querySelector('option[value="perdiem"]');
  if (kmOpt) kmOpt.hidden = !state.cfg.enableKmExpense;
  if (perdiemOpt) perdiemOpt.hidden = !state.cfg.enablePerdiemExpense;
  if ((kindSelect.value === 'km' && !state.cfg.enableKmExpense) ||
      (kindSelect.value === 'perdiem' && !state.cfg.enablePerdiemExpense)) {
    kindSelect.value = 'general';
    onExpenseKindChange();
  }
}

// Every calendar day from start to end inclusive, as 'YYYY-MM-DD' strings.
function dateRangeDays(startStr, endStr) {
  const days = [];
  const d = new Date(startStr + 'T00:00:00');
  const last = new Date(endStr + 'T00:00:00');
  while (d <= last) {
    days.push(localDateStr(d));
    d.setDate(d.getDate() + 1); // setDate (not raw ms) so DST changeover days still land on the right calendar date
  }
  return days;
}

// Verohallinto's actual rule: a "matkavuorokausi" is a rolling 24-hour period
// starting at the exact departure moment, not a calendar day. Every full
// 24h period is a kokopäiväraha; only the leftover time after the last full
// period is judged by its own length (>10h -> another full day, >6h -> half,
// otherwise nothing). An earlier version of this measured calendar days
// (midnight to midnight) instead, which over-counted the trailing day on
// 3+ day trips — e.g. depart Mon 08:00, return Wed 14:00 is 54h total: two
// full matkavuorokausi (Mon, Tue) plus a 6h remainder that does NOT clear
// the >6h bar, so no third allowance — but midnight-to-midnight measured
// Wednesday itself as 14 hours and wrongly granted it a full day too.
function classifyPerdiemDays(startStr, departureTime, endStr, returnTime) {
  const departure = new Date(`${startStr}T${departureTime || '00:00'}:00`);
  const arrival = returnTime ? new Date(`${endStr}T${returnTime}:00`) : new Date(`${endStr}T23:59:59`);
  const totalHours = Math.max(0, (arrival - departure) / 3600000);
  const fullPeriods = Math.floor(totalHours / 24);
  const remainder = totalHours - fullPeriods * 24;
  const days = [];
  for (let i = 0; i < fullPeriods; i++) {
    days.push({ date: localDateStr(new Date(departure.getTime() + i * 24 * 3600000)), hours: 24, type: 'full' });
  }
  if (remainder > 6) {
    days.push({
      date: localDateStr(new Date(departure.getTime() + fullPeriods * 24 * 3600000)),
      hours: remainder,
      type: remainder > 10 ? 'full' : 'half',
    });
  }
  return days;
}

export async function addExpense() {
  const btn = document.getElementById('exp-add-btn');
  if (btn.disabled) return; // guards the double-click race — see saveCustomerModal() for the same issue
  const kind = document.getElementById('exp-kind').value;
  const descVal = document.getElementById('exp-desc').value.trim();
  const amountFieldVal = parseFloat(document.getElementById('exp-amount').value);
  const custVal = document.getElementById('exp-customer').value;
  const dateVal = document.getElementById('exp-date').value;
  const endDateVal = document.getElementById('exp-end-date').value || dateVal;
  if (!custVal || custVal === '—') { toast(t('selectCustomer')); return; }
  if (endDateVal < dateVal) { toast(t('invalidDateRange')); return; }

  const customerId = custVal === '—' ? null : parseInt(custVal, 10);
  const cust = customerById(customerId);
  const vat = cust?.useCustomVat ? (cust.vat ?? 0) : (state.cfg.vat ?? 0);

  // Rows to create, one expense doc each — same shape as before (km/kmRate
  // null unless kind==='km'), just possibly more than one when a date range
  // spans several days.
  let rows = [];
  let confirmSummary = '';

  if (kind === 'km') {
    const km = parseFloat(descVal) || 0;
    if (km <= 0) { toast(t('enterKm')); return; }
    if (isNaN(amountFieldVal) || amountFieldVal <= 0) { toast(t('invalidPrice')); return; }
    const kmRate = amountFieldVal;
    const amount = km * kmRate;
    const desc = `${t('kmReimbursement')}: ${km} km × ${kmRate.toFixed(2).replace('.', ',')} € = ${amount.toFixed(2).replace('.', ',')} €`;
    rows = dateRangeDays(dateVal, endDateVal).map(d => ({ description: desc, amount, km, kmRate, dateStr: d }));
    if (rows.length > 1) {
      confirmSummary = t('confirmMultiDayKm')
        .replace('{count}', rows.length)
        .replace('{total}', fmtEur(amount * rows.length));
    }
  } else if (kind === 'perdiem') {
    if (state.cfg.perdiemFullRate == null || state.cfg.perdiemHalfRate == null) {
      toast(t('perdiemRatesMissing'));
      return;
    }
    const departureTime = document.getElementById('exp-departure-time').value || '00:00';
    const returnTime = document.getElementById('exp-return-time').value || '23:59';
    const classified = classifyPerdiemDays(dateVal, departureTime, endDateVal, returnTime).filter(d => d.type !== 'none');
    if (!classified.length) { toast(t('perdiemNoEligibleDays')); return; }
    rows = classified.map(d => {
      const isFull = d.type === 'full';
      const rate = isFull ? state.cfg.perdiemFullRate : state.cfg.perdiemHalfRate;
      const label = isFull ? t('perdiemFullDay') : t('perdiemHalfDay');
      return { description: descVal ? `${label} — ${descVal}` : label, amount: rate, km: 0, kmRate: null, dateStr: d.date };
    });
    if (rows.length > 1) {
      const fullCount = classified.filter(d => d.type === 'full').length;
      const halfCount = classified.filter(d => d.type === 'half').length;
      const total = rows.reduce((a, r) => a + r.amount, 0);
      confirmSummary = t('confirmPerdiem')
        .replace('{full}', fullCount).replace('{half}', halfCount).replace('{total}', fmtEur(total));
    }
  } else {
    const desc = descVal;
    if (!desc) { toast(t('expenseDescRequired')); return; }
    const amount = amountFieldVal;
    if (isNaN(amount) || amount === 0) { toast(t('enterAmount')); return; }
    rows = [{ description: desc, amount, km: 0, kmRate: null, dateStr: dateVal }];
  }

  const createRows = async () => {
    const origLabel = btn.textContent;
    btn.disabled = true; btn.textContent = t('saving');
    try {
      for (const row of rows) {
        const id = await nextId('expense');
        const expense = {
          id,
          date: row.dateStr ? new Date(row.dateStr + 'T12:00:00').toISOString() : new Date().toISOString(),
          description: row.description,
          amount: row.amount,
          vat,
          vatAmount: row.amount * vat / 100,
          customerId,
          kind,
          km: row.km,
          kmRate: row.kmRate,
          selected: false,
          invoiced: false,
        };
        state.expenses.unshift(expense);
        await createExpense(expense);
      }
      document.getElementById('exp-amount').value = '';
      document.getElementById('exp-end-date').value = '';
      document.getElementById('exp-departure-time').value = '';
      document.getElementById('exp-return-time').value = '';
      document.getElementById('exp-kind').value = 'general';
      onExpenseKindChange();
      renderExpenses();
      const kindLabel = kind === 'km' ? t('kmReimbursement') : kind === 'perdiem' ? t('expenseTypePerdiem') : t('expenseTypeGeneral');
      const countSuffix = rows.length > 1 ? ` (${rows.length})` : '';
      centerNotice(kindLabel + t('addedForCustomer') + customerName(customerId) + countSuffix);
    } finally {
      btn.disabled = false; btn.textContent = origLabel;
    }
  };

  if (rows.length > 1) {
    showConfirm(t('confirmMultiDayTitle'), confirmSummary, createRows);
  } else {
    await createRows();
  }
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
  const kirjEl = document.getElementById('kirjanpito-expenses');
  if (!kirjEl) return;
  const uninv = state.expenses.filter(e => !e.invoiced && matchesFilter(e));
  if (!uninv.length) { kirjEl.innerHTML = ''; return; }
  kirjEl.innerHTML = `<div class="card-label" style="margin-top:6px;margin-bottom:10px;">${t('expenses')}</div>` +
    uninv.map(e => `
      <div class="entry">
        <input type="checkbox" class="ecb" ${e.selected ? 'checked' : ''} onchange="toggleExpense(${e.id})">
        <div class="entry-info">
          <div class="entry-meta">${fmtDate(e.date)}</div>
          <div class="entry-dur" style="font-size:15px;">${esc(e.description)}</div>
          ${e.km ? `<div style="font-size:12px;color:var(--text2);margin-top:2px;">🚗 ${e.km} km</div>` : ''}
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

// ── 24H WARNING (manual entry + edit) ──
const SKIP_24H_WARNING_KEY = 'skip24hWarning';
let pending24hSave = null;

function should24hWarn() {
  return localStorage.getItem(SKIP_24H_WARNING_KEY) !== '1';
}

function show24hWarning(onConfirm) {
  pending24hSave = onConfirm;
  document.getElementById('modal-24h-warning').classList.add('open');
}

function closeConfirm24h() {
  document.getElementById('modal-24h-warning').classList.remove('open');
  pending24hSave = null;
}

function confirm24hProceed() {
  if (document.getElementById('confirm24h-dont-show').checked) {
    localStorage.setItem(SKIP_24H_WARNING_KEY, '1');
  }
  const fn = pending24hSave;
  document.getElementById('modal-24h-warning').classList.remove('open');
  pending24hSave = null;
  if (fn) fn();
}

window.closeConfirm24h = closeConfirm24h;
window.confirm24hProceed = confirm24hProceed;

window.addManual = addManual;
window.selManualService = selManualService;
window.selectAll = selectAll;
window.setFilter = setFilter;
window.setFilterFromSelect = setFilterFromSelect;
window.openEditEntry = openEditEntry;
window.saveEditEntry = saveEditEntry;
window.selEditService = selEditService;
window.deleteEntry = deleteEntry;
window.closeEditModal = closeEditModal;
window.toggleEntry = toggleEntry;
window.addExpense = addExpense;
window.onExpenseKindChange = onExpenseKindChange;
window.onExpenseMultiDayChange = onExpenseMultiDayChange;
window.refreshExpensePerdiemPreview = refreshExpensePerdiemPreview;
window.updateExpenseKindOptions = updateExpenseKindOptions;
window.toggleExpense = toggleExpense;
window.deleteExpense = deleteExpense;

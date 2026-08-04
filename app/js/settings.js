import { state } from './state.js';
import { t } from './i18n.js';
import {
  fmtEur, esc, isValidCompanyName, isValidAddress, isValidPhone,
  isValidEmailField, isValidYtunnus, isValidIban, todayLocalStr,
} from './utils.js';
import { toast, showConfirm } from './ui.js';
import { saveConfig } from './storage.js';
import { customerName } from './customers.js';
import { renderOrgSettings } from './org.js';
import { updateUserNameDisplay } from './auth.js';
import { initClockRate } from './clock.js';
import { renderIdeas } from './ideas.js';

function saveRounding() {
  state.cfg.rounding = parseInt(document.getElementById('set-rounding').value);
  saveConfig(); toast(t('saved'));
}

function saveMinRounding() {
  state.cfg.minRounding = parseInt(document.getElementById('set-min-rounding').value);
  saveConfig(); toast(t('saved'));
}

// Pure UI toggle — the 0%-reason row only makes sense once 0% is picked,
// but nothing is saved until saveAllSettings() runs (top save banner).
// visibility (not display) so the row keeps reserving its space either way —
// Hinnoittelu's height then stays constant regardless of VAT choice, instead
// of jumping every time this row appears/disappears.
function onVatSelectChange() {
  const val = document.getElementById('set-vat').value;
  document.getElementById('set-vat-zero-reason-row').style.visibility = val === '0' ? 'visible' : 'hidden';
}

function markSettingsDirty() {
  document.getElementById('settings-save-banner').classList.add('show');
}

// Pure UI toggle, mirrors onVatSelectChange() — only affects which rate
// rows are visible in the settings form; nothing is saved until
// saveAllSettings() runs. The perdiem rates row uses visibility (not
// display) so it keeps reserving its space either way — the card doesn't
// grow/shrink when the checkbox is toggled, same trick as the ALV0 row.
function onEnableExpenseKindChange() {
  document.getElementById('set-kmrate-inline').style.display = document.getElementById('set-enable-km').checked ? 'flex' : 'none';
  document.getElementById('set-perdiem-rates-row').style.visibility = document.getElementById('set-enable-perdiem').checked ? 'visible' : 'hidden';
}

// Re-populates every settings field from state.cfg (nothing was persisted
// yet, since saveAllSettings() hasn't run) and hides the banner — the
// simplest correct way to "undo" is to just re-render from the last saved
// state rather than tracking each field's original value separately.
function discardSettingsChanges() {
  renderSettings();
  document.getElementById('settings-save-banner').classList.remove('show');
  toast(t('changesDiscarded'));
}

export function renderSettings() {
  document.getElementById('set-company').value = state.cfg.company || '';
  document.getElementById('set-address').value = state.cfg.address || '';
  document.getElementById('set-phone').value = state.cfg.phone || '';
  document.getElementById('set-email').value = state.cfg.email || '';
  document.getElementById('set-ytunnus').value = state.cfg.ytunnus || '';
  document.getElementById('set-tilinumero').value = state.cfg.tilinumero || '';
  document.getElementById('inv-show-tilinumero').checked = state.cfg.showTilinumero !== false;
  document.getElementById('inv-show-erapaiva').checked = state.cfg.showErapaiva !== false;
  document.getElementById('inv-show-viitenumero').checked = state.cfg.showViitenumero === true;
  document.getElementById('set-rounding').value = state.cfg.rounding || 15;
  document.getElementById('set-min-rounding').value = state.cfg.minRounding || 0;
  document.getElementById('set-kmrate').value = state.cfg.kmRate ?? 0.57;
  document.getElementById('set-perdiem-full').value = state.cfg.perdiemFullRate ?? '';
  document.getElementById('set-perdiem-half').value = state.cfg.perdiemHalfRate ?? '';
  document.getElementById('set-enable-km').checked = state.cfg.enableKmExpense !== false;
  document.getElementById('set-enable-perdiem').checked = state.cfg.enablePerdiemExpense === true;
  onEnableExpenseKindChange();
  document.getElementById('set-vat').value = state.cfg.vat === null || state.cfg.vat === undefined ? '' : state.cfg.vat;
  document.getElementById('set-vat-zero-reason').value = state.cfg.vatZeroReason || '';
  document.getElementById('set-vat-zero-reason-row').style.visibility = state.cfg.vat === 0 ? 'visible' : 'hidden';
  ['fi', 'en'].forEach(l => {
    const btn = document.getElementById('btn-' + l);
    const active = state.lang === l;
    btn.style.background = active ? 'var(--blue)' : 'var(--surface)';
    btn.style.color = active ? '#fff' : 'var(--blue-txt)';
    btn.style.outlineColor = active ? 'var(--blue)' : 'var(--blue-txt)';
    btn.style.fontWeight = active ? '700' : '600';
  });
  renderServices(); renderServiceSelects(); renderOrgSettings(); renderIdeas();
}

function saveAllSettings() {
  const enableKmExpense = document.getElementById('set-enable-km').checked;
  const enablePerdiemExpense = document.getElementById('set-enable-perdiem').checked;

  const kmRate = parseFloat(document.getElementById('set-kmrate').value);
  if (isNaN(kmRate) || kmRate < 0) { toast(t('invalidPrice')); return; }

  // Optional — per diem reimbursements aren't relevant to every user, so
  // unlike VAT these may be left blank rather than forced to a value.
  const perdiemFullRaw = document.getElementById('set-perdiem-full').value;
  const perdiemHalfRaw = document.getElementById('set-perdiem-half').value;
  if (perdiemFullRaw !== '' && (isNaN(parseFloat(perdiemFullRaw)) || parseFloat(perdiemFullRaw) < 0)) { toast(t('invalidPrice')); return; }
  if (perdiemHalfRaw !== '' && (isNaN(parseFloat(perdiemHalfRaw)) || parseFloat(perdiemHalfRaw) < 0)) { toast(t('invalidPrice')); return; }
  const perdiemFullRate = perdiemFullRaw === '' ? null : parseFloat(perdiemFullRaw);
  const perdiemHalfRate = perdiemHalfRaw === '' ? null : parseFloat(perdiemHalfRaw);

  const vatRaw = document.getElementById('set-vat').value;
  if (vatRaw === '') { toast(t('invalidVat')); return; }
  const vat = parseFloat(vatRaw);
  const vatZeroReason = document.getElementById('set-vat-zero-reason').value;
  if (vat === 0 && !vatZeroReason) { toast(t('invalidVatZeroReason')); return; }

  const company    = document.getElementById('set-company').value.trim();
  const address    = document.getElementById('set-address').value.trim();
  const phone      = document.getElementById('set-phone').value.trim();
  const email      = document.getElementById('set-email').value.trim();
  const ytunnus    = document.getElementById('set-ytunnus').value.trim();
  const tilinumero = document.getElementById('set-tilinumero').value.trim();

  if (company    && !isValidCompanyName(company))    { toast(t('invalidCompanyName')); return; }
  if (address    && !isValidAddress(address))         { toast(t('invalidAddress')); return; }
  if (phone      && !isValidPhone(phone))              { toast(t('invalidPhone')); return; }
  if (email      && !isValidEmailField(email))         { toast(t('invalidEmailField')); return; }
  if (ytunnus    && !isValidYtunnus(ytunnus))          { toast(t('invalidYtunnus')); return; }
  if (tilinumero && !isValidIban(tilinumero))          { toast(t('invalidIban')); return; }

  state.cfg.company = company;
  state.cfg.address = address;
  state.cfg.phone = phone;
  state.cfg.email = email;
  state.cfg.ytunnus = ytunnus;
  state.cfg.tilinumero = tilinumero;
  state.cfg.kmRate = kmRate;
  state.cfg.perdiemFullRate = perdiemFullRate;
  state.cfg.perdiemHalfRate = perdiemHalfRate;
  state.cfg.enableKmExpense = enableKmExpense;
  state.cfg.enablePerdiemExpense = enablePerdiemExpense;
  state.cfg.vat = vat;
  state.cfg.vatZeroReason = vat === 0 ? vatZeroReason : null;
  saveConfig(); updateUserNameDisplay();
  window.updateExpenseKindOptions?.();
  document.getElementById('settings-save-banner').classList.remove('show');
  toast(t('saved'), 'success');
}

// ── PALVELUT ──
function addService() {
  const n = document.getElementById('svc-name').value.trim();
  const r = parseFloat(document.getElementById('svc-rate').value);
  if (!n || isNaN(r) || r < 0) { toast(t('fillServiceName')); return; }
  state.cfg.services.push({ id: Date.now(), name: n, rate: r });
  document.getElementById('svc-name').value = '';
  document.getElementById('svc-rate').value = '';
  state.cfg.hourly = state.cfg.services[0].rate;
  saveConfig(); renderServices(); renderServiceSelects(); toast(t('serviceAdded'));
}

function removeService(id) {
  if (state.cfg.services.length <= 1) { toast(t('minOneService')); return; }
  showConfirm(t('deleteService'), t('deleteServiceConfirm'), () => {
    state.cfg.services = state.cfg.services.filter(s => s.id !== id);
    state.cfg.hourly = state.cfg.services[0].rate;
    saveConfig(); renderServices(); renderServiceSelects(); toast(t('serviceRemoved'));
  });
}

function updateServiceName(id, name) {
  const s = state.cfg.services.find(x => x.id === id);
  if (!s || !name.trim()) return;
  s.name = name.trim();
  saveConfig(); renderServiceSelects();
}

function updateServiceRate(id, rate) {
  const s = state.cfg.services.find(x => x.id === id);
  const r = parseFloat(rate);
  if (!s || isNaN(r) || r < 0) return;
  s.rate = r;
  if (state.cfg.services[0].id === id) state.cfg.hourly = r;
  saveConfig(); renderServiceSelects();
}

function renderServices() {
  const el = document.getElementById('services-list');
  if (!el) return;
  el.innerHTML = state.cfg.services.map(s => `
    <div class="rec-item">
      <input type="text" value="${esc(s.name)}" onchange="updateServiceName(${s.id}, this.value)" style="flex:1;min-width:0;border:none;background:none;color:var(--text);font-size:15px;font-weight:600;padding:0;outline:none;">
      <div class="rec-right">
        <input type="number" value="${s.rate}" min="0" step="0.5" onchange="updateServiceRate(${s.id}, this.value)" style="width:64px;border:1.5px solid var(--border2);border-radius:8px;padding:5px 6px;font-size:14px;font-weight:700;text-align:right;background:var(--bg);color:var(--text);">
        <span style="font-size:13px;color:var(--text2);">€/h</span>
        <span class="rec-rm" onclick="removeService(${s.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </span>
      </div>
    </div>`).join('');
}

export function renderServiceSelects() {
  const opts = state.cfg.services.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  ['m-service', 'edit-service'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
  const mRate = document.getElementById('m-rate');
  if (mRate && state.cfg.services.length) mRate.value = state.cfg.services[0].rate;
  initClockRate();
}

function saveInvoiceSettings() {
  const tilinumeroBox = document.getElementById('inv-show-tilinumero');
  const viitenumeroBox = document.getElementById('inv-show-viitenumero');
  const hasTilinumero = !!(state.cfg.tilinumero && state.cfg.tilinumero.trim());

  // Viitenumero is only meaningful alongside an actual account to pay into,
  // and toggling "Tilinumero" on with nothing set would just show an empty line —
  // so both require a saved tilinumero before they can be switched on.
  if ((tilinumeroBox.checked || viitenumeroBox.checked) && !hasTilinumero) {
    tilinumeroBox.checked = false;
    viitenumeroBox.checked = false;
    toast(t('bankAccountRequiredForToggle'));
    return;
  }

  state.cfg.showTilinumero = tilinumeroBox.checked;
  state.cfg.showErapaiva = document.getElementById('inv-show-erapaiva').checked;
  state.cfg.showViitenumero = viitenumeroBox.checked;
  saveConfig();
}

function downloadBackup() {
  const data = {
    exportedAt: new Date().toISOString(),
    cfg: state.cfg,
    customers: state.customers,
    entries: state.entries,
    invoices: state.invoices,
    expenses: state.expenses,
    eId: state.eId, iId: state.iId, eExpId: state.eExpId, cId: state.cId,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tyotunnit-varmuuskopio-${todayLocalStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast(t('backupDownloaded'));
}

function openAddRecurringModal() {
  document.getElementById('rec-name').value = '';
  document.getElementById('rec-amount').value = '';
  const custSel = document.getElementById('rec-customer');
  custSel.value = '—';
  custSel.dataset.prevValue = '—';
  document.getElementById('modal-recurring').classList.add('open');
}

function closeRecurringModal() {
  document.getElementById('modal-recurring').classList.remove('open');
}

function addRecurring() {
  const n = document.getElementById('rec-name').value.trim();
  const a = parseFloat(document.getElementById('rec-amount').value);
  const c = document.getElementById('rec-customer').value;
  if (!n || isNaN(a) || a <= 0) { toast(t('fillDesc')); return; }
  if (!c || c === '—') { toast(t('selectCustomer')); return; }
  state.cfg.recurring.push({ id: Date.now(), name: n, amount: a, customerId: parseInt(c, 10) });
  closeRecurringModal();
  saveConfig(); renderRecList(); toast(t('added'), 'success');
}

function removeRecurring(id) {
  showConfirm(t('deleteRecurring'), t('deleteRecurringConfirm'), () => {
    state.cfg.recurring = state.cfg.recurring.filter(r => r.id !== id);
    saveConfig(); renderRecList();
  });
}

let editingRecurringId = null;

function startEditRecurring(id) {
  editingRecurringId = id;
  renderRecList();
}

function updateRecurringAmount(id, value) {
  const r = state.cfg.recurring.find(x => x.id === id);
  const a = parseFloat(value);
  if (r && !isNaN(a) && a > 0) {
    r.amount = a;
    saveConfig();
  }
  editingRecurringId = null;
  renderRecList();
}

export function renderRecList() {
  const el = document.getElementById('rec-list');
  const badge = document.getElementById('rec-count-badge');
  if (badge) badge.textContent = state.cfg.recurring.length;
  if (!state.cfg.recurring.length) {
    el.innerHTML = `<div style="font-size:14px;color:var(--text2);padding:4px 0">${t('noRecurring')}</div>`;
    return;
  }
  el.innerHTML = '<div class="rec-scroll-list">' + state.cfg.recurring.map(r => {
    const isEditing = editingRecurringId === r.id;
    const amountHtml = isEditing
      ? `<input type="number" min="0" step="0.5" value="${r.amount}"
           onblur="updateRecurringAmount(${r.id}, this.value)"
           onkeydown="if(event.key==='Enter'){this.blur()}"
           style="width:72px;border:1.5px solid var(--border2);border-radius:8px;padding:5px 6px;font-size:14px;font-weight:700;text-align:right;background:var(--bg);color:var(--text);">`
      : `<span class="rec-eur">${fmtEur(r.amount)}${t('perMonth')}</span>`;
    return `
    <div class="rec-item">
      <div>
        <div class="rec-name">${esc(r.name)}</div>
        <div class="rec-sub">${esc(customerName(r.customerId) || t('allCustomers'))}</div>
      </div>
      <div class="rec-right">
        ${amountHtml}
        <span class="rec-edit" onclick="startEditRecurring(${r.id})" title="${t('edit')}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </span>
        <span class="rec-rm" onclick="removeRecurring(${r.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </span>
      </div>
    </div>`;
  }).join('') + '</div>';
  if (editingRecurringId !== null) {
    const input = el.querySelector('input[type="number"]');
    if (input) { input.focus(); input.select(); }
  }
}

window.saveAllSettings = saveAllSettings;
window.saveRounding = saveRounding;
window.saveMinRounding = saveMinRounding;
window.onVatSelectChange = onVatSelectChange;
window.markSettingsDirty = markSettingsDirty;
window.onEnableExpenseKindChange = onEnableExpenseKindChange;
window.discardSettingsChanges = discardSettingsChanges;
window.saveInvoiceSettings = saveInvoiceSettings;
window.downloadBackup = downloadBackup;
window.addRecurring = addRecurring;
window.openAddRecurringModal = openAddRecurringModal;
window.closeRecurringModal = closeRecurringModal;
window.removeRecurring = removeRecurring;
window.startEditRecurring = startEditRecurring;
window.updateRecurringAmount = updateRecurringAmount;
window.addService = addService;
window.removeService = removeService;
window.updateServiceName = updateServiceName;
window.updateServiceRate = updateServiceRate;

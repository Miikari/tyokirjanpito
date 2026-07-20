import { state } from './state.js';
import { t } from './i18n.js';
import { fmtEur, esc } from './utils.js';
import { toast } from './ui.js';
import { save } from './storage.js';
import { renderCustChips, renderAllSelects } from './customers.js';
import { renderOrgSettings } from './org.js';
import { updateUserNameDisplay } from './auth.js';
import { initClockRate } from './clock.js';

function saveRounding() {
  state.cfg.rounding = parseInt(document.getElementById('set-rounding').value);
  save(); toast(t('saved'));
}

function saveVat() {
  state.cfg.vat = parseFloat(document.getElementById('set-vat').value);
  save(); toast(t('saved'));
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
  document.getElementById('set-kmrate').value = state.cfg.kmRate ?? 0.57;
  document.getElementById('set-vat').value = state.cfg.vat || 0;
  ['fi', 'en'].forEach(l => {
    const btn = document.getElementById('btn-' + l);
    const active = state.lang === l;
    btn.style.background = active ? 'var(--blue)' : '#fff';
    btn.style.color = active ? '#fff' : 'var(--blue-txt)';
    btn.style.outlineColor = active ? 'var(--blue)' : 'var(--blue-txt)';
    btn.style.fontWeight = active ? '700' : '600';
  });
  renderRecList(); renderServices(); renderServiceSelects(); renderCustChips(); renderAllSelects(); renderOrgSettings();
}

function saveAllSettings() {
  const kmRate = parseFloat(document.getElementById('set-kmrate').value);
  if (isNaN(kmRate) || kmRate < 0) { toast(t('invalidPrice')); return; }
  state.cfg.company = document.getElementById('set-company').value.trim();
  state.cfg.address = document.getElementById('set-address').value.trim();
  state.cfg.phone = document.getElementById('set-phone').value.trim();
  state.cfg.email = document.getElementById('set-email').value.trim();
  state.cfg.ytunnus = document.getElementById('set-ytunnus').value.trim();
  state.cfg.tilinumero = document.getElementById('set-tilinumero').value.trim();
  state.cfg.kmRate = kmRate;
  save(); updateUserNameDisplay(); toast(t('saved'));
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
  save(); renderServices(); renderServiceSelects(); toast(t('serviceAdded'));
}

function removeService(id) {
  if (state.cfg.services.length <= 1) { toast(t('minOneService')); return; }
  state.cfg.services = state.cfg.services.filter(s => s.id !== id);
  state.cfg.hourly = state.cfg.services[0].rate;
  save(); renderServices(); renderServiceSelects(); toast(t('serviceRemoved'));
}

function updateServiceName(id, name) {
  const s = state.cfg.services.find(x => x.id === id);
  if (!s || !name.trim()) return;
  s.name = name.trim();
  save(); renderServiceSelects();
}

function updateServiceRate(id, rate) {
  const s = state.cfg.services.find(x => x.id === id);
  const r = parseFloat(rate);
  if (!s || isNaN(r) || r < 0) return;
  s.rate = r;
  if (state.cfg.services[0].id === id) state.cfg.hourly = r;
  save(); renderServiceSelects();
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
  state.cfg.showTilinumero = document.getElementById('inv-show-tilinumero').checked;
  state.cfg.showErapaiva = document.getElementById('inv-show-erapaiva').checked;
  state.cfg.showViitenumero = document.getElementById('inv-show-viitenumero').checked;
  save();
}

function downloadBackup() {
  const data = {
    exportedAt: new Date().toISOString(),
    cfg: state.cfg,
    entries: state.entries,
    invoices: state.invoices,
    expenses: state.expenses,
    eId: state.eId, iId: state.iId, eExpId: state.eExpId,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tyotunnit-varmuuskopio-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast(t('backupDownloaded'));
}

function addRecurring() {
  const n = document.getElementById('rec-name').value.trim();
  const a = parseFloat(document.getElementById('rec-amount').value);
  const c = document.getElementById('rec-customer').value;
  if (!n || isNaN(a) || a <= 0) { toast(t('fillDesc')); return; }
  state.cfg.recurring.push({ id: Date.now(), name: n, amount: a, customer: c === '—' ? null : c });
  document.getElementById('rec-name').value = '';
  document.getElementById('rec-amount').value = '';
  save(); renderRecList(); toast(t('added'));
}

function removeRecurring(id) {
  state.cfg.recurring = state.cfg.recurring.filter(r => r.id !== id);
  save(); renderRecList();
}

function renderRecList() {
  const el = document.getElementById('rec-list');
  if (!state.cfg.recurring.length) {
    el.innerHTML = `<div style="font-size:14px;color:var(--text2);padding:4px 0">${t('noRecurring')}</div>`;
    return;
  }
  el.innerHTML = state.cfg.recurring.map(r => `
    <div class="rec-item">
      <div>
        <div class="rec-name">${esc(r.name)}</div>
        <div class="rec-sub">${esc(r.customer || t('allCustomers'))}</div>
      </div>
      <div class="rec-right">
        <span class="rec-eur">${fmtEur(r.amount)}${t('perMonth')}</span>
        <span class="rec-rm" onclick="removeRecurring(${r.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </span>
      </div>
    </div>`).join('');
}

window.saveAllSettings = saveAllSettings;
window.saveRounding = saveRounding;
window.saveVat = saveVat;
window.saveInvoiceSettings = saveInvoiceSettings;
window.downloadBackup = downloadBackup;
window.addRecurring = addRecurring;
window.removeRecurring = removeRecurring;
window.addService = addService;
window.removeService = removeService;
window.updateServiceName = updateServiceName;
window.updateServiceRate = updateServiceRate;

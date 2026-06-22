import { state } from './state.js';
import { t } from './i18n.js';
import { fmtEur, esc } from './utils.js';
import { toast } from './ui.js';
import { save } from './storage.js';
import { renderCustChips, renderAllSelects } from './customers.js';
import { renderOrgSettings } from './org.js';

function saveRounding() {
  state.cfg.rounding = parseInt(document.getElementById('set-rounding').value);
  save(); toast(t('saved'));
}

function saveCompany() {
  state.cfg.company = document.getElementById('set-company').value.trim();
  state.cfg.address = document.getElementById('set-address').value.trim();
  state.cfg.phone = document.getElementById('set-phone').value.trim();
  state.cfg.email = document.getElementById('set-email').value.trim();
  state.cfg.ytunnus = document.getElementById('set-ytunnus').value.trim();
  state.cfg.tilinumero = document.getElementById('set-tilinumero').value.trim();
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
  document.getElementById('set-hourly').value = state.cfg.hourly;
  document.getElementById('set-kmrate').value = state.cfg.kmRate ?? 0.57;
  document.getElementById('set-vat').value = state.cfg.vat || 0;
  previewHourly();
  ['fi', 'en'].forEach(l => {
    const btn = document.getElementById('btn-' + l);
    const active = state.lang === l;
    btn.style.background = active ? 'var(--blue)' : '#fff';
    btn.style.color = active ? '#fff' : 'var(--blue-txt)';
    btn.style.outlineColor = active ? 'var(--blue)' : 'var(--blue-txt)';
    btn.style.fontWeight = active ? '700' : '600';
  });
  renderRecList(); renderCustChips(); renderAllSelects(); renderOrgSettings();
}

function previewHourly() {
  const v = parseFloat(document.getElementById('set-hourly').value) || 0;
  document.getElementById('hourly-hint').textContent = '8h = ' + fmtEur(8 * v) + ' · 160h = ' + fmtEur(160 * v);
}

function saveHourly() {
  const v = parseFloat(document.getElementById('set-hourly').value);
  if (isNaN(v) || v < 0) { toast(t('invalidPrice')); return; }
  state.cfg.hourly = v; save(); previewHourly(); toast(t('saved') + fmtEur(v) + '/h');
}

function saveKmRate() {
  const v = parseFloat(document.getElementById('set-kmrate').value);
  if (isNaN(v) || v < 0) { toast(t('invalidPrice')); return; }
  state.cfg.kmRate = v; save(); toast(t('kmRateSaved') + ': ' + String(v).replace('.', ',') + ' €/km');
}

function saveInvoiceSettings() {
  state.cfg.showTilinumero = document.getElementById('inv-show-tilinumero').checked;
  state.cfg.showErapaiva = document.getElementById('inv-show-erapaiva').checked;
  state.cfg.showViitenumero = document.getElementById('inv-show-viitenumero').checked;
  save();
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
        <span class="rec-eur">${fmtEur(r.amount)}/kk</span>
        <span class="rec-rm" onclick="removeRecurring(${r.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </span>
      </div>
    </div>`).join('');
}

window.saveCompany = saveCompany;
window.saveHourly = saveHourly;
window.saveKmRate = saveKmRate;
window.saveRounding = saveRounding;
window.saveVat = saveVat;
window.saveInvoiceSettings = saveInvoiceSettings;
window.addRecurring = addRecurring;
window.removeRecurring = removeRecurring;
window.previewHourly = previewHourly;

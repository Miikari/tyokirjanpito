import { state, STILL_IMG, ANIM_GIF } from './state.js';
import { t } from './i18n.js';
import { renderMainBtns, renderPills } from './clock.js';
import { renderEntries } from './entries.js';
import { renderArchive } from './invoices.js';
import { renderReports } from './reports.js';
import { renderSettings } from './settings.js';

// ── LANG ──
function setLang(l) {
  state.lang = l;
  localStorage.setItem('lang', l);
  ['fi', 'en'].forEach(code => {
    const btn = document.getElementById('btn-' + code);
    const active = code === l;
    btn.style.background = active ? 'var(--blue)' : '#fff';
    btn.style.color = active ? '#fff' : 'var(--blue-txt)';
    btn.style.outlineColor = active ? 'var(--blue)' : 'var(--blue-txt)';
    btn.style.fontWeight = active ? '700' : '600';
  });
  applyLang();
}

export function applyLang() {
  document.querySelector('.login-title').textContent = t('loginTitle');
  const subEl = document.querySelector('.login-sub');
  subEl.textContent = '';
  subEl.append(t('loginSub'), document.createElement('br'), t('loginSub2'));
  document.querySelector('.btn-google').lastChild.textContent = ' ' + t('loginBtn');
  const footerEl = document.querySelector('.login-footer');
  footerEl.textContent = '';
  footerEl.append(t('loginFooter'), document.createElement('br'), t('loginFooter2'));

  document.querySelector('.install-banner span').textContent = t('installBanner');
  document.querySelector('#install-banner button').textContent = t('install');

  document.querySelector('.btn-logout').textContent = t('logout');
  document.querySelectorAll('.tab')[0].textContent = t('kello');
  document.querySelectorAll('.tab')[1].textContent = t('kirjanpito');
  document.querySelectorAll('.tab')[2].querySelector('.tab-label').textContent = t('arkisto');
  document.querySelectorAll('.tab')[3].textContent = t('raportointi');
  document.querySelectorAll('.tab')[4].textContent = t('asetukset');

  document.querySelector('.card-label').textContent = t('manualEntry');
  document.querySelector('#notes-toggle-icon').nextSibling.textContent = ' ' + t('addNotes');
  document.getElementById('clock-notes').placeholder = t('notesPlaceholder');
  document.getElementById('m-notes').placeholder = t('mNotesPlaceholder');

  document.querySelectorAll('.sum-label')[0].textContent = t('entries');
  document.querySelectorAll('.sum-label')[1].textContent = t('selected');
  document.querySelectorAll('.sum-label')[2].textContent = t('total');
  document.querySelectorAll('.sum-label')[3].textContent = t('value');
  document.querySelector('.btn-outline').textContent = t('selectAll');
  document.querySelector('.btn-invoice').textContent = t('buildInvoice');

  document.querySelector('#modal h2').textContent = t('recurring');
  document.querySelectorAll('#modal .modal-opt')[0].textContent = t('addAllRecurring');
  document.querySelectorAll('#modal .modal-opt')[1].textContent = t('addCustomerRecurring');
  document.querySelectorAll('#modal .modal-opt')[2].textContent = t('noRecurringInvoice');
  document.querySelectorAll('#modal .modal-opt')[3].textContent = t('cancel');
  document.querySelector('#modal-edit h2').textContent = t('editEntry');
  document.querySelector('#modal-edit .modal-opt.primary').textContent = t('saveChanges');
  document.querySelector('#modal-edit .modal-cancel').textContent = t('cancel');
  document.querySelector('#modal-edit-inv h2').textContent = t('editInvoice');
  document.querySelector('#modal-edit-inv .modal-opt.primary').textContent = t('saveChanges');
  document.querySelector('#modal-edit-inv .modal-cancel').textContent = t('cancel');
  document.getElementById('confirm-ok').textContent = t('yes');
  document.querySelector('#modal-confirm .modal-cancel').textContent = t('cancel');

  document.getElementById('label-language').textContent = t('language');
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t(key) !== key) el.textContent = t(key);
  });
  document.getElementById('rec-name').placeholder = t('recNamePlaceholder');
  document.getElementById('exp-desc').placeholder = t('expenseDescPlaceholder');
  const orgJoinInput = document.getElementById('org-join-input');
  if (orgJoinInput) orgJoinInput.placeholder = t('orgJoinPlaceholder');
  ['fi', 'en'].forEach(l => {
    const btn = document.getElementById('btn-' + l);
    const active = state.lang === l;
    btn.style.background = active ? 'var(--blue)' : '#fff';
    btn.style.color = active ? '#fff' : 'var(--blue-txt)';
    btn.style.outlineColor = active ? 'var(--blue)' : 'var(--blue-txt)';
    btn.style.fontWeight = active ? '700' : '600';
  });

  renderMainBtns(); renderPills(); renderEntries(); renderArchive();
  if (document.getElementById('panel-raportointi').classList.contains('active')) renderReports();
  if (document.getElementById('panel-asetukset').classList.contains('active')) renderSettings();
}

// ── TOAST ──
export function toast(msg) {
  const el = document.getElementById('toast');
  clearTimeout(toast._t);
  el.textContent = msg; el.classList.add('show');
  toast._t = setTimeout(() => el.classList.remove('show'), 2400);
}

// ── TABS ──
function showTab(tab, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(tb => tb.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  if (btn) btn.classList.add('active');
  if (tab === 'kirjanpito')  renderEntries();
  if (tab === 'arkisto')     renderArchive();
  if (tab === 'raportointi') renderReports();
  if (tab === 'asetukset')   renderSettings();
}

export function goTab(tab) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(tb => tb.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  document.querySelectorAll('.tab').forEach(tb => { if (tb.dataset.tab === tab) tb.classList.add('active'); });
}

// ── CLOCK BG ──
export function updateClockBg() {
  const bg = document.getElementById('clock-bg');
  if (!bg) return;
  if (state.clockState === 'running' || state.clockState === 'paused') {
    bg.style.backgroundImage = `url('${ANIM_GIF}?t=${Date.now()}')`;
  } else {
    bg.style.backgroundImage = `url('${STILL_IMG}')`;
  }
}

// ── NOTES ──
function toggleNotes() {
  const box = document.getElementById('notes-box');
  const icon = document.getElementById('notes-toggle-icon');
  const open = box.style.display === 'none';
  box.style.display = open ? 'block' : 'none';
  icon.textContent = open ? '−' : '+';
}

// ── CONFIRM MODAL ──
export function showConfirm(title, text, onOk) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent = text;
  document.getElementById('confirm-ok').onclick = () => { closeConfirm(); onOk(); };
  document.getElementById('modal-confirm').classList.add('open');
}

function closeConfirm() {
  document.getElementById('modal-confirm').classList.remove('open');
}

window.showTab = showTab;
window.setLang = setLang;
window.toggleNotes = toggleNotes;
window.closeConfirm = closeConfirm;

applyLang();

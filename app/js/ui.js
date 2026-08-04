import { state, STILL_IMG, ANIM_GIF } from './state.js';
import { t } from './i18n.js';
import { renderMainBtns, renderPills } from './clock.js';
import { renderEntries } from './entries.js';
import { renderArchive } from './invoices.js';
import { renderReports } from './reports.js';
import { renderSettings, renderRecList } from './settings.js';
import { renderBillingSettings } from './billing.js';
import { renderCustChips, renderAllSelects } from './customers.js';

// ── ASIAKKAAT TAB ──
function renderAsiakkaatTab() {
  renderCustChips();
  renderAllSelects();
  renderRecList();
}

// ── KELLO SUB-NAV (Kirjaa / Raportit) ──
function showKelloSub(which, btn) {
  document.querySelectorAll('#panel-kello .subpanel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.kello-subnav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('subpanel-' + which).classList.add('active');
  if (btn) btn.classList.add('active');
  if (which === 'raportit') renderReports();
}

// ── LANG ──
function setLang(l) {
  state.lang = l;
  localStorage.setItem('lang', l);
  ['fi', 'en'].forEach(code => {
    const btn = document.getElementById('btn-' + code);
    const active = code === l;
    btn.style.background = active ? 'var(--blue)' : 'var(--surface)';
    btn.style.color = active ? '#fff' : 'var(--blue-txt)';
    btn.style.outlineColor = active ? 'var(--blue)' : 'var(--blue-txt)';
    btn.style.fontWeight = active ? '700' : '600';
  });
  applyLang();
}

// ── THEME ──
function setTheme(theme) {
  state.theme = theme;
  localStorage.setItem('theme', theme);
  applyTheme();
}

export function applyTheme() {
  if (state.theme === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  ['light', 'dark'].forEach(mode => {
    const btn = document.getElementById('btn-theme-' + mode);
    if (!btn) return;
    const active = state.theme === mode;
    btn.style.background = active ? 'var(--blue)' : 'var(--surface)';
    btn.style.color = active ? '#fff' : 'var(--blue-txt)';
    btn.style.outlineColor = active ? 'var(--blue)' : 'var(--blue-txt)';
    btn.style.fontWeight = active ? '700' : '600';
  });
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

  document.querySelectorAll('.tab')[0].textContent = t('kello');
  document.querySelectorAll('.tab')[1].textContent = t('kirjanpito');
  document.querySelectorAll('.tab')[2].querySelector('.tab-label').textContent = t('arkisto');
  document.querySelectorAll('.tab')[3].textContent = t('customersLabel');

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

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t(key) !== key) el.textContent = t(key);
  });
  document.getElementById('rec-name').placeholder = t('recNamePlaceholder');
  document.getElementById('exp-desc').placeholder = t('expenseDescPlaceholder');
  document.getElementById('svc-name').placeholder = t('serviceNamePlaceholder');
  document.getElementById('arch-search').placeholder = t('archSearchPlaceholder');
  const orgJoinInput = document.getElementById('org-join-input');
  if (orgJoinInput) orgJoinInput.placeholder = t('orgJoinPlaceholder');
  const ideaInput = document.getElementById('idea-input');
  if (ideaInput) ideaInput.placeholder = t('ideasPlaceholder');
  ['fi', 'en'].forEach(l => {
    const btn = document.getElementById('btn-' + l);
    const active = state.lang === l;
    btn.style.background = active ? 'var(--blue)' : 'var(--surface)';
    btn.style.color = active ? '#fff' : 'var(--blue-txt)';
    btn.style.outlineColor = active ? 'var(--blue)' : 'var(--blue-txt)';
    btn.style.fontWeight = active ? '700' : '600';
  });

  renderMainBtns(); renderPills(); renderEntries(); renderArchive(); renderBillingSettings();
  if (document.getElementById('subpanel-raportit').classList.contains('active')) renderReports();
  if (document.getElementById('panel-asetukset').classList.contains('active')) renderSettings();
  if (document.getElementById('panel-asiakkaat').classList.contains('active')) renderAsiakkaatTab();
}

// ── TOAST ──
export function toast(msg, type = null) {
  const el = document.getElementById('toast');
  clearTimeout(toast._t);
  el.textContent = msg; el.classList.add('show');
  el.classList.toggle('toast-success', type === 'success');
  toast._t = setTimeout(() => el.classList.remove('show'), 2400);
}

// ── TABS ──
// Blocks navigating away from Asetukset while the unsaved-changes banner is
// showing, until the user explicitly hits Tallenna or Peru — a stray tab
// switch (or the phone back button) would otherwise silently discard
// whatever they'd just typed. Shakes the banner as a nudge instead of
// failing silently.
function settingsHasUnsavedChanges() {
  return document.getElementById('panel-asetukset').classList.contains('active')
    && document.getElementById('settings-save-banner').classList.contains('show');
}

function shakeSettingsBanner() {
  const banner = document.getElementById('settings-save-banner');
  banner.classList.remove('shake');
  // Force reflow so re-adding the class restarts the animation even if a
  // previous shake hasn't finished (e.g. two rapid tab-switch attempts).
  void banner.offsetWidth;
  banner.classList.add('shake');
}

export function showTab(tab, btn) {
  if (tab !== 'asetukset' && settingsHasUnsavedChanges()) {
    shakeSettingsBanner();
    return;
  }
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(tb => tb.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  if (btn) btn.classList.add('active');
  if (tab === 'kirjanpito')  renderEntries();
  if (tab === 'arkisto')     renderArchive();
  if (tab === 'asiakkaat')   renderAsiakkaatTab();
  if (tab === 'asetukset')   renderSettings();
  // Työnäkymä may be showing its Raportit sub-view — keep it fresh on return.
  if (tab === 'kello' && document.getElementById('subpanel-raportit').classList.contains('active')) renderReports();
}

export function goTab(tab) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(tb => tb.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  document.querySelectorAll('.tab').forEach(tb => { if (tb.dataset.tab === tab) tb.classList.add('active'); });
}

// ── PHONE BACK BUTTON ──
// A bare SPA has no history entries of its own, so the phone's back button
// exits the app immediately from anywhere. This traps it instead:
//  - an open modal/dialog is closed first, consuming the press;
//  - a back press from any tab other than Työnäkymä just goes home;
//  - a back press while already on Työnäkymä arms a short "press again to
//    exit" window *without* re-arming the history trap, so there's nothing
//    left to catch a second physical back press within that window and the
//    OS closes the app for real (the classic Android "press back again to
//    exit"). If no second press comes, the trap is silently restored once
//    the window expires.
const MODAL_CLOSERS = {
  modal: 'closeModal',
  'modal-edit': 'closeEditModal',
  'modal-edit-inv': 'closeEditInvModal',
  'modal-invoice-view': 'closeInvoicePopup',
  'modal-customer': 'closeCustomerModal',
  'modal-recurring': 'closeRecurringModal',
  'modal-confirm': 'closeConfirm',
  'modal-24h-warning': 'closeConfirm24h',
  'modal-upgrade': 'closeUpgradeModal',
  'join-modal': 'closeJoinModal',
};

function armBackTrap() {
  history.pushState({ tyoaikaBackTrap: true }, '', location.href);
}

const EXIT_CONFIRM_WINDOW_MS = 2000;
let exitArmedAt = 0;
let exitRearmTimer = null;

window.addEventListener('popstate', () => {
  clearTimeout(exitRearmTimer);

  const openModalId = Object.keys(MODAL_CLOSERS).find(id => {
    const el = document.getElementById(id);
    return el && el.classList.contains('open');
  });
  if (openModalId) {
    window[MODAL_CLOSERS[openModalId]]();
    exitArmedAt = 0;
    armBackTrap();
    return;
  }

  if (settingsHasUnsavedChanges()) {
    shakeSettingsBanner();
    exitArmedAt = 0;
    armBackTrap();
    return;
  }

  const onKello = document.getElementById('panel-kello').classList.contains('active');
  if (!onKello) {
    showTab('kello', document.querySelector('.tab[data-tab="kello"]'));
    exitArmedAt = 0;
    armBackTrap();
    return;
  }
  if (Date.now() - exitArmedAt < EXIT_CONFIRM_WINDOW_MS) {
    exitArmedAt = 0; // second press in time — leave the trap down, let this one exit
    return;
  }
  exitArmedAt = Date.now();
  toast(t('pressBackAgainExit'));
  exitRearmTimer = setTimeout(() => { exitArmedAt = 0; armBackTrap(); }, EXIT_CONFIRM_WINDOW_MS);
});

armBackTrap();

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

// ── USER MENU ──
function toggleUserMenu(e) {
  e.stopPropagation();
  document.getElementById('user-menu').classList.toggle('open');
}

function closeUserMenu() {
  document.getElementById('user-menu').classList.remove('open');
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('user-menu');
  if (menu && menu.classList.contains('open') && !menu.contains(e.target)) closeUserMenu();
});

// ── INFO TOOLTIPS ──
function toggleInfoTip(btn, e) {
  if (e) e.stopPropagation();
  const tip = btn.closest('.info-tip');
  const wasOpen = tip.classList.contains('open');
  document.querySelectorAll('.info-tip.open').forEach(el => el.classList.remove('open'));
  if (!wasOpen) tip.classList.add('open');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.info-tip')) {
    document.querySelectorAll('.info-tip.open').forEach(el => el.classList.remove('open'));
  }
});

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

// ── HELP MODAL ──
function openHelpModal() {
  document.getElementById('modal-help').classList.add('open');
}

function closeHelpModal() {
  document.getElementById('modal-help').classList.remove('open');
}

window.showTab = showTab;
window.showKelloSub = showKelloSub;
window.setLang = setLang;
window.setTheme = setTheme;
window.toggleNotes = toggleNotes;
window.closeConfirm = closeConfirm;
window.toggleUserMenu = toggleUserMenu;
window.closeUserMenu = closeUserMenu;
window.toggleInfoTip = toggleInfoTip;
window.openHelpModal = openHelpModal;
window.closeHelpModal = closeHelpModal;

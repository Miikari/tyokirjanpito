import { state } from './state.js';
import { t } from './i18n.js';
import { fmtDur, fmtDate, esc } from './utils.js';
import { toast, updateClockBg } from './ui.js';
import { save } from './storage.js';
import { addEntry } from './entries.js';

export function tick() {
  const total = Math.floor((state.elapsedMs + (Date.now() - state.startTime)) / 1000);
  document.getElementById('timer').textContent = fmtDur(total);
  state.timerRaf = requestAnimationFrame(tick);
}

function getActiveService() {
  const services = state.cfg.services || [];
  const found = services.find(s => s.id === state.activeServiceId);
  return found || services[0] || { id: null, name: '', rate: state.cfg.hourly };
}

export function renderServiceOptions() {
  const el = document.getElementById('service-select');
  if (!el) return;
  const services = state.cfg.services || [];
  if (!services.some(s => s.id === state.activeServiceId)) {
    state.activeServiceId = services[0]?.id ?? null;
  }
  el.innerHTML = services.map(s => `<option value="${s.id}"${s.id === state.activeServiceId ? ' selected' : ''}>${esc(s.name)}</option>`).join('');
}

const EYE_ICON = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
const EYE_OFF_ICON = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';

export function applyHideRate() {
  const wrap = document.getElementById('clock-rate-value-wrap');
  if (wrap) wrap.style.display = state.cfg.hideRate ? 'none' : 'flex';
  const icon = document.getElementById('hide-rate-icon');
  if (icon) icon.innerHTML = state.cfg.hideRate ? EYE_OFF_ICON : EYE_ICON;
  const btn = document.getElementById('hide-rate-btn');
  if (btn) btn.title = state.cfg.hideRate ? t('showRate') : t('hideRate');
}

export function initClockRate() {
  renderServiceOptions();
  const svc = getActiveService();
  const input = document.getElementById('clock-rate-input');
  if (input) input.value = svc.rate;
  const val = document.getElementById('clock-rate-val');
  if (val) val.textContent = svc.rate.toFixed(2).replace('.', ',') + ' €/h';
  applyHideRate();
}

function selService(id) {
  state.activeServiceId = parseInt(id, 10);
  const svc = getActiveService();
  document.getElementById('clock-rate-input').value = svc.rate;
  document.getElementById('clock-rate-val').textContent = svc.rate.toFixed(2).replace('.', ',') + ' €/h';
}

function toggleHideRate() {
  state.cfg.hideRate = !state.cfg.hideRate;
  save();
  applyHideRate();
}

function enableClockRateEdit() {
  document.getElementById('clock-rate-display').style.display = 'none';
  document.getElementById('clock-rate-edit').style.display = 'flex';
  const inp = document.getElementById('clock-rate-input');
  inp.focus(); inp.select();
}

function confirmClockRateEdit() {
  const val = parseFloat(document.getElementById('clock-rate-input').value);
  if (!isNaN(val) && val >= 0) {
    document.getElementById('clock-rate-val').textContent = val.toFixed(2).replace('.', ',') + ' €/h';
    document.getElementById('clock-rate-input').value = val;
  }
  document.getElementById('clock-rate-display').style.display = 'flex';
  document.getElementById('clock-rate-edit').style.display = 'none';
}

function clockIn() {
  if (!state.activeCustomer) { toast(t('selectCustomer')); return; }
  state.clockState = 'running'; state.clockInDate = new Date(); state.startTime = Date.now(); state.elapsedMs = 0;
  const clockRate = parseFloat(document.getElementById('clock-rate-input').value) || state.cfg.hourly;
  const clockService = getActiveService().name;
  if (state.uid) {
    db.collection('users').doc(state.uid).collection('data').doc('active').set({
      startTime: state.startTime, clockInDate: state.clockInDate.toISOString(), customer: state.activeCustomer, rate: clockRate, service: clockService
    });
  }
  state.timerRaf = requestAnimationFrame(tick);
  const th = state.clockInDate.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('timer-sub').textContent = fmtDate(state.clockInDate) + ' — aloitettu ' + th;
  setBadge('running', '● Töissä'); renderMainBtns();
  toast(t('clockedIn') + state.activeCustomer);
  updateClockBg();
}

function togglePause() {
  if (state.clockState === 'running') {
    state.clockState = 'paused'; state.elapsedMs += Date.now() - state.startTime;
    cancelAnimationFrame(state.timerRaf);
    setBadge('paused', t('onBreak')); renderMainBtns(); toast(t('taukoAlkaa'));
    updateClockBg();
  } else {
    state.clockState = 'running'; state.startTime = Date.now();
    state.timerRaf = requestAnimationFrame(tick);
    setBadge('running', t('working')); renderMainBtns(); toast(t('jatko'));
    updateClockBg();
  }
}

function clockOut() {
  if (state.clockState === 'running') state.elapsedMs += Date.now() - state.startTime;
  cancelAnimationFrame(state.timerRaf);
  const rawSecs = Math.floor(state.elapsedMs / 1000);
  if (rawSecs < 1) { toast(t('noTime')); return; }
  const interval = (state.cfg.rounding || 15) * 60;
  const secs = state.cfg.rounding === 1 ? rawSecs : Math.ceil(rawSecs / interval) * interval;
  const notes = document.getElementById('clock-notes').value.trim();
  const rate = parseFloat(document.getElementById('clock-rate-input').value) || state.cfg.hourly;
  const km = parseFloat(document.getElementById('clock-km').value) || 0;
  addEntry(state.clockInDate, secs, state.activeCustomer, t('kello'), notes, rate, km, getActiveService().name);
  document.getElementById('clock-notes').value = '';
  document.getElementById('clock-km').value = '';
  document.getElementById('notes-box').style.display = 'none';
  document.getElementById('notes-toggle-icon').textContent = '+';
  state.clockState = 'idle'; state.elapsedMs = 0; state.startTime = null;
  document.getElementById('timer').textContent = '00:00:00';
  document.getElementById('timer-sub').textContent = '—';
  setBadge('idle', t('idle')); renderMainBtns();
  if (state.uid) db.collection('users').doc(state.uid).collection('data').doc('active').delete();
  initClockRate();
  save(); toast(t('kirjattu') + fmtDur(secs));
  updateClockBg();
}

export function setBadge(type, txt) {
  const el = document.getElementById('clock-badge');
  el.className = 'clock-badge cb-' + type; el.textContent = txt;
}

export function renderMainBtns() {
  const r = document.getElementById('main-btns');
  if (state.clockState === 'idle') {
    r.innerHTML = `<button class="btn btn-signin" onclick="clockIn()">${t('clockIn')}</button>`;
  } else {
    const pauseLabel = state.clockState === 'paused' ? '▶ Jatka' : '⏸ Tauko';
    r.innerHTML = `<button class="btn btn-pause" onclick="togglePause()">${pauseLabel}</button>
                   <button class="btn btn-signout" onclick="clockOut()">${t('logout')}</button>`;
  }
}

export function renderPills() {
  const el = document.getElementById('cust-select');
  const isLocked = state.clockState !== 'idle';
  const svcEl = document.getElementById('service-select');
  if (svcEl) svcEl.disabled = isLocked;
  if (!state.cfg.customers.length) {
    el.innerHTML = `<option value="">${t('noCustomer')}</option>`;
    el.disabled = true;
    return;
  }
  const sorted = [...state.cfg.customers].sort((a, b) => a.name.localeCompare(b.name, 'fi', { sensitivity: 'base' }));
  el.innerHTML = [`<option value=""${state.activeCustomer ? '' : ' selected'}>— ${t('noCustomer')} —</option>`,
    ...sorted.map(c => `<option value="${esc(c.name)}"${state.activeCustomer === c.name ? ' selected' : ''}>${esc(c.name)}</option>`)
  ].join('');
  el.disabled = isLocked;
}

function selCust(n) {
  state.activeCustomer = n || null;
  renderPills();
}

window.clockIn = clockIn;
window.clockOut = clockOut;
window.togglePause = togglePause;
window.selCust = selCust;
window.selService = selService;
window.toggleHideRate = toggleHideRate;
window.enableClockRateEdit = enableClockRateEdit;
window.confirmClockRateEdit = confirmClockRateEdit;

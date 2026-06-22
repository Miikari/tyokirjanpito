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

export function initClockRate() {
  const input = document.getElementById('clock-rate-input');
  if (input) input.value = state.cfg.hourly;
  const val = document.getElementById('clock-rate-val');
  if (val) val.textContent = state.cfg.hourly.toFixed(2).replace('.', ',') + ' €/h';
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
  if (state.uid) {
    db.collection('users').doc(state.uid).collection('data').doc('active').set({
      startTime: state.startTime, clockInDate: state.clockInDate.toISOString(), customer: state.activeCustomer, rate: clockRate
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
  addEntry(state.clockInDate, secs, state.activeCustomer, t('kello'), notes, rate, km);
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
  const el = document.getElementById('pills');
  if (!state.cfg.customers.length) { el.innerHTML = ''; return; }
  el.innerHTML = state.cfg.customers.map(c =>
    `<div class="pill ${state.activeCustomer === c.name ? 'active' : ''}" onclick="selCust(${esc(JSON.stringify(c.name))})">${esc(c.name)}</div>`
  ).join('');
}

function selCust(n) {
  if (state.clockState === 'running' || state.clockState === 'paused') {
    toast(t('cannotSwitch'));
    return;
  }
  state.activeCustomer = state.activeCustomer === n ? null : n;
  renderPills();
}

window.clockIn = clockIn;
window.clockOut = clockOut;
window.togglePause = togglePause;
window.selCust = selCust;
window.enableClockRateEdit = enableClockRateEdit;
window.confirmClockRateEdit = confirmClockRateEdit;

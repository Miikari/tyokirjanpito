function tick() {
  const total = Math.floor((elapsedMs + (Date.now() - startTime)) / 1000);
  document.getElementById('timer').textContent = fmtDur(total);
  timerRaf = requestAnimationFrame(tick);
}

function initClockRate() {
  const input = document.getElementById('clock-rate-input');
  if (input) input.value = cfg.hourly;
  const val = document.getElementById('clock-rate-val');
  if (val) val.textContent = cfg.hourly.toFixed(2).replace('.', ',') + ' €/h';
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
  if (!activeCustomer) { toast(t('selectCustomer')); return; }
  state = 'running'; clockInDate = new Date(); startTime = Date.now(); elapsedMs = 0;
  const clockRate = parseFloat(document.getElementById('clock-rate-input').value) || cfg.hourly;
  if (uid) {
    db.collection('users').doc(uid).collection('data').doc('active').set({
      startTime: startTime, clockInDate: clockInDate.toISOString(), customer: activeCustomer, rate: clockRate
    });
  }
  timerRaf = requestAnimationFrame(tick);
  const th = clockInDate.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('timer-sub').textContent = fmtDate(clockInDate) + ' — aloitettu ' + th;
  setBadge('running', '● Töissä'); renderMainBtns();
  toast(t('clockedIn') + activeCustomer);
  updateClockBg();
}

function togglePause() {
  if (state === 'running') {
    state = 'paused'; elapsedMs += Date.now() - startTime;
    cancelAnimationFrame(timerRaf);
    setBadge('paused', t('onBreak')); renderMainBtns(); toast(t('taukoAlkaa'));
    updateClockBg();
  } else {
    state = 'running'; startTime = Date.now();
    timerRaf = requestAnimationFrame(tick);
    setBadge('running', t('working')); renderMainBtns(); toast(t('jatko'));
    updateClockBg();
  }
}

function clockOut() {
  if (state === 'running') elapsedMs += Date.now() - startTime;
  cancelAnimationFrame(timerRaf);
  const rawSecs = Math.floor(elapsedMs / 1000);
  if (rawSecs < 1) { toast(t('noTime')); return; }
  const interval = (cfg.rounding || 15) * 60;
  const secs = cfg.rounding === 1 ? rawSecs : Math.ceil(rawSecs / interval) * interval;
  const notes = document.getElementById('clock-notes').value.trim();
  const rate = parseFloat(document.getElementById('clock-rate-input').value) || cfg.hourly;
  addEntry(clockInDate, secs, activeCustomer, t('kello'), notes, rate);
  document.getElementById('clock-notes').value = '';
  document.getElementById('notes-box').style.display = 'none';
  document.getElementById('notes-toggle-icon').textContent = '+';
  state = 'idle'; elapsedMs = 0; startTime = null;
  document.getElementById('timer').textContent = '00:00:00';
  document.getElementById('timer-sub').textContent = '—';
  setBadge('idle', t('idle')); renderMainBtns();
  if (uid) db.collection('users').doc(uid).collection('data').doc('active').delete();
  initClockRate();
  save(); toast(t('kirjattu') + fmtDur(secs));
  updateClockBg();
}

function setBadge(type, txt) {
  const el = document.getElementById('clock-badge');
  el.className = 'clock-badge cb-' + type; el.textContent = txt;
}

function renderMainBtns() {
  const r = document.getElementById('main-btns');
  if (state === 'idle') {
    r.innerHTML = `<button class="btn btn-signin" onclick="clockIn()">${t('clockIn')}</button>`;
  } else {
    const pauseLabel = state === 'paused' ? '▶ Jatka' : '⏸ Tauko';
    r.innerHTML = `<button class="btn btn-pause" onclick="togglePause()">${pauseLabel}</button>
                   <button class="btn btn-signout" onclick="clockOut()">${t('logout')}</button>`;
  }
}

function renderPills() {
  const el = document.getElementById('pills');
  if (!cfg.customers.length) { el.innerHTML = ''; return; }
  el.innerHTML = cfg.customers.map(c =>
    `<div class="pill ${activeCustomer === c.name ? 'active' : ''}" onclick="selCust(${esc(JSON.stringify(c.name))})">${esc(c.name)}</div>`
  ).join('');
}

function selCust(n) {
  if (state === 'running' || state === 'paused') {
    toast(t('cannotSwtich'));
    return;
  }
  activeCustomer = activeCustomer === n ? null : n;
  renderPills();
}

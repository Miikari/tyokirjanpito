import { state } from './state.js';
import { t } from './i18n.js';
import { fmtDate } from './utils.js';
import { toast, updateClockBg } from './ui.js';
import { initClockRate, renderMainBtns, renderPills, setBadge, tick } from './clock.js';
import { renderAllSelects } from './customers.js';
import { renderEntries } from './entries.js';

function mainRef() {
  return db.collection('orgs').doc(state.orgId).collection('data').doc('main');
}

export async function loadFromFirestore() {
  try {
    const doc = await mainRef().get();
    if (doc.exists) {
      const d = doc.data();
      if (d.entries)  state.entries  = d.entries;
      if (d.invoices) state.invoices = d.invoices;
      if (d.eId)      state.eId      = d.eId;
      if (d.iId)      state.iId      = d.iId;
      if (d.cfg)      state.cfg      = Object.assign(state.cfg, d.cfg);
      state.cfg.customers = (state.cfg.customers || []).map(c => {
        if (typeof c === 'string') return { name: c };
        if (c.osoite && !c.katuosoite) { c = { ...c, katuosoite: c.osoite }; delete c.osoite; }
        return c;
      });
    }
  } catch (e) { toast(t('latausVirhe') + e.message); }

  initClockRate();
  document.getElementById('m-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('m-rate').value = state.cfg.hourly;
  renderAllSelects(); renderPills(); renderEntries();

  try {
    const activeDoc = await db.collection('users').doc(state.uid).collection('data').doc('active').get();
    if (activeDoc.exists) {
      const a = activeDoc.data();
      state.startTime = a.startTime;
      state.clockInDate = new Date(a.clockInDate);
      state.activeCustomer = a.customer;
      const savedRate = a.rate || state.cfg.hourly;
      document.getElementById('clock-rate-input').value = savedRate;
      document.getElementById('clock-rate-val').textContent = savedRate.toFixed(2).replace('.', ',') + ' €/h';
      state.elapsedMs = 0;
      state.clockState = 'running';
      state.timerRaf = requestAnimationFrame(tick);
      const th = state.clockInDate.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
      document.getElementById('timer-sub').textContent = fmtDate(state.clockInDate) + ' — aloitettu ' + th;
      setBadge('running', '● Töissä'); renderMainBtns(); renderPills();
      updateClockBg();
    }
  } catch (e) { toast(t('latausVirhe')); }
}

export function save() {
  if (!state.orgId) return;
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(async () => {
    try {
      await mainRef().set(
        { entries: state.entries, invoices: state.invoices, eId: state.eId, iId: state.iId, cfg: state.cfg }, { merge: true }
      );
    } catch (e) { toast(t('tallennusVirhe')); }
  }, 800);
}
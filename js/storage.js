import { state } from './state.js';
import { t } from './i18n.js';
import { fmtDate } from './utils.js';
import { toast, updateClockBg } from './ui.js';
import { initClockRate, renderMainBtns, renderPills, setBadge, syncSelectLabel, tick } from './clock.js';
import { renderAllSelects } from './customers.js';
import { renderEntries } from './entries.js';
import { renderServiceSelects } from './settings.js';

function mainRef() {
  return db.collection('orgs').doc(state.orgId).collection('data').doc('main');
}

export async function loadFromFirestore() {
  try {
    const doc = await mainRef().get();
    if (doc.exists) {
      const d = doc.data();
      if (d.entries)   state.entries   = d.entries;
      if (d.invoices)  state.invoices  = d.invoices;
      if (d.expenses)  state.expenses  = d.expenses;
      if (d.eId)       state.eId       = d.eId;
      if (d.iId)       state.iId       = d.iId;
      if (d.eExpId)    state.eExpId    = d.eExpId;
      if (d.cfg)       state.cfg       = Object.assign(state.cfg, d.cfg);
      state.cfg.customers = (state.cfg.customers || []).map(c => {
        if (typeof c === 'string') return { name: c };
        if (c.osoite && !c.katuosoite) { c = { ...c, katuosoite: c.osoite }; delete c.osoite; }
        return c;
      });
      if (!state.cfg.services || !state.cfg.services.length) {
        state.cfg.services = [{ id: 1, name: state.lang === 'en' ? 'Hourly work' : 'Tuntityö', rate: state.cfg.hourly ?? 50 }];
      }
    }
  } catch (e) { toast(t('latausVirhe') + e.message); }

  renderServiceSelects();
  document.getElementById('m-date').value = new Date().toISOString().slice(0, 10);
  renderAllSelects(); renderPills(); renderEntries();
  window.updateInvoiceBadge?.();

  try {
    const activeDoc = await db.collection('users').doc(state.uid).collection('data').doc('active').get();
    if (activeDoc.exists) {
      const a = activeDoc.data();
      state.startTime = a.startTime;
      state.clockInDate = new Date(a.clockInDate);
      state.activeCustomer = a.customer;
      const matchedService = state.cfg.services.find(s => s.name === a.service);
      state.activeServiceId = matchedService ? matchedService.id : state.cfg.services[0]?.id ?? null;
      const svcSel = document.getElementById('service-select');
      if (svcSel) svcSel.value = state.activeServiceId;
      syncSelectLabel('service-select', 'service-select-label');
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

let activeUnsub = null;

export function listenActiveState() {
  if (activeUnsub) { activeUnsub(); activeUnsub = null; }
  if (!state.uid) return;

  activeUnsub = db.collection('users').doc(state.uid).collection('data').doc('active')
    .onSnapshot(async doc => {
      if (!state.uid) return;
      if (doc.exists) {
        const a = doc.data();
        if (state.clockState !== 'idle' && state.startTime === a.startTime) return;
        state.startTime = a.startTime;
        state.clockInDate = new Date(a.clockInDate);
        state.activeCustomer = a.customer;
        const matchedService = state.cfg.services.find(s => s.name === a.service);
        state.activeServiceId = matchedService ? matchedService.id : state.cfg.services[0]?.id ?? null;
        const svcSel = document.getElementById('service-select');
        if (svcSel) svcSel.value = state.activeServiceId;
        syncSelectLabel('service-select', 'service-select-label');
        const savedRate = a.rate || state.cfg.hourly;
        document.getElementById('clock-rate-input').value = savedRate;
        document.getElementById('clock-rate-val').textContent = savedRate.toFixed(2).replace('.', ',') + ' €/h';
        state.elapsedMs = 0;
        if (state.clockState !== 'running') {
          cancelAnimationFrame(state.timerRaf);
          state.clockState = 'running';
          state.timerRaf = requestAnimationFrame(tick);
        }
        const th = state.clockInDate.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('timer-sub').textContent = fmtDate(state.clockInDate) + ' — aloitettu ' + th;
        setBadge('running', '● Töissä'); renderMainBtns(); renderPills();
        updateClockBg();
      } else if (state.clockState !== 'idle') {
        cancelAnimationFrame(state.timerRaf);
        state.clockState = 'idle'; state.elapsedMs = 0; state.startTime = null;
        state.clockInDate = null; state.activeCustomer = null;
        document.getElementById('timer').textContent = '00:00:00';
        document.getElementById('timer-sub').textContent = '—';
        setBadge('idle', ''); renderMainBtns(); renderPills();
        updateClockBg();
        toast('Kello pysäytetty toisella laitteella');
        await loadFromFirestore();
      }
    }, () => {});
}

export function unlistenActiveState() {
  if (activeUnsub) { activeUnsub(); activeUnsub = null; }
}

export function save() {
  if (!state.orgId) return;
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(async () => {
    try {
      await mainRef().set(
        { entries: state.entries, invoices: state.invoices, expenses: state.expenses, eId: state.eId, iId: state.iId, eExpId: state.eExpId, cfg: state.cfg }, { merge: true }
      );
    } catch (e) { toast(t('tallennusVirhe')); }
  }, 800);
}
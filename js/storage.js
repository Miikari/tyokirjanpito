async function loadFromFirestore() {
  try {
    const doc = await db.collection('users').doc(uid).collection('data').doc('main').get();
    if (doc.exists) {
      const d = doc.data();
      if (d.entries)  entries  = d.entries;
      if (d.invoices) invoices = d.invoices;
      if (d.eId)      eId      = d.eId;
      if (d.iId)      iId      = d.iId;
      if (d.cfg)      cfg      = Object.assign(cfg, d.cfg);
      // Normalize customers: strings → objects, migrate old osoite → katuosoite
      cfg.customers = (cfg.customers || []).map(c => {
        if (typeof c === 'string') return { name: c };
        if (c.osoite && !c.katuosoite) { c = { ...c, katuosoite: c.osoite }; delete c.osoite; }
        return c;
      });
    }
  } catch (e) { toast(t('latausVirhe') + e.message); }

  initClockRate();
  document.getElementById('m-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('m-rate').value = cfg.hourly;
  renderAllSelects(); renderPills(); renderEntries();

  try {
    const activeDoc = await db.collection('users').doc(uid).collection('data').doc('active').get();
    if (activeDoc.exists) {
      const a = activeDoc.data();
      startTime = a.startTime;
      clockInDate = new Date(a.clockInDate);
      activeCustomer = a.customer;
      const savedRate = a.rate || cfg.hourly;
      document.getElementById('clock-rate-input').value = savedRate;
      document.getElementById('clock-rate-val').textContent = savedRate.toFixed(2).replace('.', ',') + ' €/h';
      elapsedMs = 0;
      state = 'running';
      timerRaf = requestAnimationFrame(tick);
      const th = clockInDate.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
      document.getElementById('timer-sub').textContent = fmtDate(clockInDate) + ' — aloitettu ' + th;
      setBadge('running', '● Töissä'); renderMainBtns(); renderPills();
      updateClockBg();
    }
  } catch (e) { toast(t('latausVirhe')); }
}

function save() {
  if (!uid) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await db.collection('users').doc(uid).collection('data').doc('main').set(
        { entries, invoices, eId, iId, cfg }, { merge: true }
      );
    } catch (e) { toast(t('tallennusVirhe')); }
  }, 800);
}

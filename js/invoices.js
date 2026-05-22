function startInvoice() {
  const sel = entries.filter(e => e.selected && !e.invoiced);
  if (!sel.length) { toast(t('selectEntries')); return; }
  pending = sel;
  if (!cfg.recurring.length) { finishInvoice(false); return; }

  const custs = [...new Set(sel.map(e => e.customer).filter(Boolean))];
  const relevantRecurring = custs.length === 1
    ? cfg.recurring.filter(r => !r.customer || r.customer === custs[0])
    : cfg.recurring;

  if (!relevantRecurring.length) { finishInvoice(false); return; }

  document.getElementById('modal-text').textContent =
    `Valitsit ${sel.length} ${t('entries_count')} ${custs.length ? ' (' + custs.join(', ') + ')' : ''}.  ${t('doAddRecurring')}`;

  pendingRecurring = relevantRecurring;
  document.getElementById('modal').classList.add('open');
}

function closeModal() { document.getElementById('modal').classList.remove('open'); pending = null; }

function finishInvoice(mode) {
  document.getElementById('modal').classList.remove('open');
  const sel = pending; if (!sel) return; pending = null;
  const recurring = pendingRecurring || cfg.recurring;
  pendingRecurring = null;
  let rec = [];
  if (mode === true) rec = [...recurring];
  else if (mode === 'customer') {
    const custs = [...new Set(sel.map(e => e.customer).filter(Boolean))];
    rec = recurring.filter(r => r.customer && custs.includes(r.customer));
  }
  const totalSecs = sel.reduce((a, e) => a + e.secs, 0);
  const hourly = sel.reduce((a, e) => a + (e.secs / 3600) * (e.rate ?? cfg.hourly), 0);
  const monthly = rec.reduce((a, r) => a + r.amount, 0);
  const subtotal = hourly + monthly;
  const vatAmount = subtotal * (cfg.vat || 0) / 100;
  const invoiceCustomers = [...new Set(sel.map(e => e.customer).filter(Boolean))];
  const primaryCust = invoiceCustomers.length === 1 ? cfg.customers.find(c => c.name === invoiceCustomers[0]) : null;
  const maksuehto = primaryCust?.maksuehto ?? 10;
  invoices.unshift({
    id: ++iId, date: new Date().toISOString(),
    entries: sel.map(e => ({ ...e })), totalSecs, hourly, monthly,
    subtotal, vatAmount, vat: cfg.vat || 0,
    total: subtotal + vatAmount, recurring: rec, maksuehto
  });
  sel.forEach(e => { e.invoiced = true; e.selected = false; });
  filterCustomer = null;
  save(); renderEntries();
  toast(t('invoicePrefix') + String(iId).padStart(3, '0') + ' arkistoitu');
  goTab('arkisto'); setTimeout(() => renderArchive(iId), 80);
}

function renderArchive(highlightId) {
  const el = document.getElementById('archive-list');
  if (!invoices.length) { el.innerHTML = `<div class="empty">${t('noInvoices')}</div>`; return; }
  el.innerHTML = invoices.map(inv => {
    const isOpen = highlightId === inv.id;
    const rows = inv.entries.map(e => `
      <div class="inv-row-line">
        <div class="inv-row-left">
          <div class="inv-row-title">${fmtDur(e.secs)}</div>
          <div class="inv-row-sub">${fmtDate(e.date)}${e.customer ? ' · ' + e.customer : ''}</div>
        </div>
        <div class="inv-row-val">${fmtEur((e.secs / 3600) * (e.rate ?? cfg.hourly))}</div>
      </div>`).join('');
    const recRows = inv.recurring.map(r => `
      <div class="inv-row-line">
        <div class="inv-row-left">
          <div class="inv-row-title">${r.name}</div>
          <div class="inv-row-sub">${t('monthlyCharge')}${r.customer ? ' · ' + r.customer : ''}</div>
        </div>
        <div class="inv-row-val">${fmtEur(r.amount)}</div>
      </div>`).join('');
    const custs = [...new Set(inv.entries.map(e => e.customer).filter(Boolean))];
    return `
      <div class="inv-card">
        <div class="inv-header" onclick="this.nextElementSibling.classList.toggle('open')">
          <div>
            <div class="inv-num">${t('invoicePrefix')}${String(inv.id).padStart(3, '0')}</div>
            <div class="inv-sub">${fmtDate(inv.date)}${custs.length ? ' · ' + custs.join(', ') : ''}</div>
          </div>
          <div class="inv-right">
            <div class="inv-total">${fmtEur(inv.total)}</div>
            <div class="inv-tag">${t('archived')}</div>
          </div>
        </div>
        <div class="inv-body ${isOpen ? 'open' : ''}">
          <div class="inv-meta">${fmtDate(inv.date)} · ${fmtShort(inv.totalSecs)} h</div>
          ${rows}${recRows}
          <div class="inv-subtotals">
            ${inv.vat > 0 ? `
              <div class="inv-subtotal-line"><span>${t('vatExcl')}</span><span>${fmtEur(inv.subtotal)}</span></div>
              <div class="inv-subtotal-line"><span>ALV ${inv.vat}%</span><span>${fmtEur(inv.vatAmount)}</span></div>
            ` : ''}
            <div class="inv-grand">
              <span class="inv-grand-label">${t('grandTotal')}</span>
              <span class="inv-grand-val">${fmtEur(inv.total)}</span>
            </div>
          </div>
          <div style="display:flex;gap:10px;margin-top:14px;">
            <button class="btn-outline" style="flex:1;" onclick="printInvoice(${inv.id})">${t('printPdf')}</button>
            <button class="btn-outline" style="flex:1;" onclick="printInvoice(${inv.id},true)">Tulosta liitteeksi</button>
            <button class="btn-outline" style="flex:1;" onclick="openEditInvoice(${inv.id})">${t('edit')}</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function printInvoice(id, asAttachment) {
  const inv = invoices.find(x => x.id === id);
  if (!inv) return;

  const rows = inv.entries.map(e => `
    <tr>
      <td>${fmtDate(e.date)}</td>
      <td>${fmtEur(e.rate ?? cfg.hourly)}</td>
      <td>${fmtHours(e.secs)}</td>
      <td>${e.notes || '—'}</td>
      <td style="text-align:right">${fmtEur((e.secs / 3600) * (e.rate ?? cfg.hourly))}</td>
    </tr>`).join('');
  const recRows = inv.recurring.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${1}</td>
      <td></td>
      <td></td>
      <td style="text-align:right">${fmtEur(r.amount)}</td>
    </tr>`).join('');

  const custs = [...new Set(inv.entries.map(e => e.customer).filter(Boolean))];
  const primaryCustObj = custs.length === 1 ? cfg.customers.find(c => c.name === custs[0]) : null;
  const custAddrLines = primaryCustObj ? [
    primaryCustObj.ytunnus ? 'Y-tunnus: ' + primaryCustObj.ytunnus : '',
    primaryCustObj.katuosoite || '',
    [primaryCustObj.postinumero, primaryCustObj.postitoimipaikka].filter(Boolean).join(' '),
    primaryCustObj.sposti || '',
    primaryCustObj.puhelin || '',
  ].filter(Boolean).map(l => `<div style="font-size:13px;color:#555;line-height:1.5;">${l}</div>`).join('') : '';

  const companyBlock = cfg.company ? `
    <div style="text-align:right;">
      <div style="font-size:18px;font-weight:700;margin:0;line-height:1.2;">${cfg.company}</div>
      ${cfg.ytunnus ? `<div style="font-size:13px;color:#666;margin-top:2px;">Y-tunnus: ${cfg.ytunnus}</div>` : ''}
      ${cfg.address ? `<div style="font-size:13px;color:#666;">${cfg.address}</div>` : ''}
      ${cfg.phone ? `<div style="font-size:13px;color:#666;">${cfg.phone}</div>` : ''}
      ${cfg.email ? `<div style="font-size:13px;color:#666;">${cfg.email}</div>` : ''}
    </div>` : '';

  let headerLeft, paymentBlock;
  if (asAttachment) {
    headerLeft = `
      <h1 style="font-size:20px;font-weight:700;margin:0 0 2px 0;line-height:1;">Tuntierittely</h1>
      <div style="margin-top:4px; font-size 16px;">${fmtDate(inv.date)}</div>
      <div class="inv-customer">${custs.join(', ') || '—'}</div>
      ${custAddrLines}`;
    paymentBlock = '';
  } else {
    const maksuehto = inv.maksuehto ?? 10;
    const maksuehtoText = maksuehto === 'sopimus' ? 'Erillisen sopimuksen mukaan' : maksuehto + ' pv';
    const erapaiva = calcErapaiva(inv.date, maksuehto);
    const viitenumero = calcViitenumero(inv.id);
    const showPaymentBox = cfg.showErapaiva || cfg.showViitenumero || cfg.showTilinumero;
    headerLeft = `
      <h1 style="font-size:20px;font-weight:700;margin:0 0 4px 0;line-height:1;">${t('invoice')} #${String(inv.id).padStart(3, '0')}</h1>
      <div class="sub">${fmtDate(inv.date)}</div>
      <div class="inv-customer" style="margin-top:8px;">${custs.join(', ') || '—'}</div>
      ${custAddrLines}`;
    const payItems = [
      cfg.showErapaiva ? `<div><div class="pay-item-label">Maksuehto</div><div class="pay-item-val">${maksuehtoText}</div></div>` : '',
      cfg.showErapaiva && maksuehto !== 'sopimus' ? `<div><div class="pay-item-label">Eräpäivä</div><div class="pay-item-val">${erapaiva}</div></div>` : '',
      cfg.showViitenumero ? `<div><div class="pay-item-label">Viitenumero</div><div class="pay-item-val">${viitenumero}</div></div>` : '',
      cfg.showTilinumero && cfg.tilinumero ? `<div><div class="pay-item-label">Tilinumero</div><div class="pay-item-val">${cfg.tilinumero}</div></div>` : '',
    ].filter(Boolean).join('');
    paymentBlock = showPaymentBox && payItems ? `<div class="pay-box">${payItems}</div>` : '';
  }

  const title = asAttachment
    ? `Tuntierittely - ${custs.join(', ') || fmtDate(inv.date)}`
    : `Lasku #${String(inv.id).padStart(3, '0')}`;

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>${title}</title>
    <style>
      body { font-family: -apple-system, sans-serif; padding: 40px; color: #111; max-width: 760px; margin: 0 auto; }
      h1 { font-size: 24px; margin-bottom: 2px; }
      .inv-customer { font-size: 16px; font-weight: 700; color: #111; margin-bottom: 2px; }
      .sub { color: #666; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 24px; table-layout: fixed; }
      th { text-align: left; border-bottom: 2px solid #111; padding: 8px 4px; font-size: 13px; }
      td { padding: 10px 4px; border-bottom: 1px solid #ddd; font-size: 14px; vertical-align: top; word-wrap: break-word; }
      th:nth-child(1), td:nth-child(1) { width: 100px; }
      th:nth-child(2), td:nth-child(2) { width: 75px; }
      th:nth-child(3), td:nth-child(3) { width: 85px; }
      th:nth-child(4), td:nth-child(4) { width: auto; }
      th:nth-child(5), td:nth-child(5) { width: 90px; text-align: right; }
      .total-section { padding-top: 8px; }
      .total-line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; color: #666; }
      .grand { display: flex; justify-content: space-between; padding-top: 8px; margin-top: 8px; border-top: 2px solid #111; }
      .grand-label { font-size: 18px; font-weight: 700; }
      .grand-val { font-size: 24px; font-weight: 800; }
      .pay-box { display:flex; gap:32px; flex-wrap:wrap; background:#f5f5f5; border-radius:8px; padding:14px 18px; margin-bottom:24px; }
      .pay-item-label { font-size:10px; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:4px; }
      .pay-item-val { font-size:14px; font-weight:600; color:#111; }
      @media print { button { display: none; } }
    </style>
  </head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;">
      <div style="margin-top:0;padding-top:0;">${headerLeft}</div>
      ${companyBlock}
    </div>
    ${paymentBlock}
    <table>
      <thead><tr>
        <th>${t('date')}</th>
        <th>${t('hourlyRate')}</th>
        <th>${t('total')}</th>
        <th>${t('notes')}</th>
        <th style="text-align:right">${t('amount')}</th>
      </tr></thead>
      <tbody>${rows}${recRows}</tbody>
    </table>
    <div class="total-section">
      ${inv.vat > 0 ? `
        <div class="total-line"><span>${t('vatExcl')}</span><span>${fmtEur(inv.subtotal)}</span></div>
        <div class="total-line"><span>ALV ${inv.vat}%</span><span>${fmtEur(inv.vatAmount)}</span></div>
      ` : ''}
      <div class="grand">
        <span class="grand-label">${t('grandTotal')}</span>
        <span class="grand-val">${fmtEur(inv.total)}</span>
      </div>
    </div>
    <br><button onclick="window.print()" style="padding:12px 24px;background:#1976D2;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">🖨 ${t('printPdf')}</button>
  </body></html>`);
  win.document.close();
}

// ── EDIT INVOICE ──
function openEditInvoice(id) {
  const inv = invoices.find(x => x.id === id);
  if (!inv) return;
  editingInvId = id;
  const el = document.getElementById('edit-inv-entries');
  el.innerHTML = inv.entries.map((e, i) => `
    <div style="background:var(--bg);border-radius:var(--r-sm);padding:12px;margin-bottom:10px;">
      <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px;">${fmtDate(e.date)} · ${e.customer || '—'}</div>
      <div style="display:flex;gap:8px;margin-bottom:6px;">
        <div class="fg" style="flex:1;margin:0;"><label>Tunnit</label><input type="number" id="einv-h-${i}" value="${Math.floor(e.secs / 3600)}" min="0" max="24"></div>
        <div class="fg" style="flex:1;margin:0;"><label>Minuutit</label><input type="number" id="einv-m-${i}" value="${Math.floor((e.secs % 3600) / 60)}" min="0" max="59"></div>
      </div>
      <div class="fg" style="margin:0;"><label>Merkintöjä</label><input type="text" id="einv-notes-${i}" value="${e.notes || ''}" placeholder="Merkintä..."></div>
    </div>
  `).join('');
  document.getElementById('modal-edit-inv').classList.add('open');
}

function saveEditInvoice() {
  const inv = invoices.find(x => x.id === editingInvId);
  if (!inv) return;
  inv.entries.forEach((e, i) => {
    const h = parseInt(document.getElementById(`einv-h-${i}`).value) || 0;
    const m = parseInt(document.getElementById(`einv-m-${i}`).value) || 0;
    e.secs = h * 3600 + m * 60;
    e.notes = document.getElementById(`einv-notes-${i}`).value.trim();
  });
  const totalSecs = inv.entries.reduce((a, e) => a + e.secs, 0);
  const hourly = inv.entries.reduce((a, e) => a + (e.secs / 3600) * (e.rate ?? cfg.hourly), 0);
  const subtotal = hourly + inv.monthly;
  const vatAmount = subtotal * (inv.vat || 0) / 100;
  inv.totalSecs = totalSecs;
  inv.hourly = hourly;
  inv.subtotal = subtotal;
  inv.vatAmount = vatAmount;
  inv.total = subtotal + vatAmount;
  closeEditInvModal();
  save(); renderArchive(); toast(t('invoiceUpdated'));
}

function closeEditInvModal() {
  document.getElementById('modal-edit-inv').classList.remove('open');
  editingInvId = null;
}

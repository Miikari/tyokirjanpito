import { state } from './state.js';
import { t } from './i18n.js';
import { fmtDate, fmtDur, fmtEur, fmtHours, fmtShort, esc, calcViitenumero, calcErapaiva } from './utils.js';
import { toast, goTab } from './ui.js';
import { save } from './storage.js';
import { renderEntries, renderExpenses } from './entries.js';

function startInvoice() {
  const sel = state.entries.filter(e => e.selected && !e.invoiced);
  if (!sel.length) { toast(t('selectEntries')); return; }
  state.pending = sel;
  if (!state.cfg.recurring.length) { finishInvoice(false); return; }

  const custs = [...new Set(sel.map(e => e.customer).filter(Boolean))];
  const primaryCustObj = custs.length === 1 ? state.cfg.customers.find(c => c.name === custs[0]) : null;
  if (!primaryCustObj?.ytunnus) { finishInvoice(false); return; }

  const relevantRecurring = state.cfg.recurring.filter(r => r.customer === custs[0]);
  if (!relevantRecurring.length) { finishInvoice(false); return; }

  document.getElementById('modal-text').textContent =
    `Valitsit ${sel.length} ${t('entries_count')} ${custs.length ? ' (' + custs.join(', ') + ')' : ''}.  ${t('doAddRecurring')}`;

  state.pendingRecurring = relevantRecurring;
  document.getElementById('modal').classList.add('open');
}

function closeModal() { document.getElementById('modal').classList.remove('open'); state.pending = null; }

function finishInvoice(mode) {
  document.getElementById('modal').classList.remove('open');
  const sel = state.pending; if (!sel) return; state.pending = null;
  const recurring = state.pendingRecurring || state.cfg.recurring;
  state.pendingRecurring = null;
  let rec = [];
  if (mode === true) rec = [...recurring];
  else if (mode === 'customer') {
    const custs = [...new Set(sel.map(e => e.customer).filter(Boolean))];
    rec = recurring.filter(r => r.customer && custs.includes(r.customer));
  }
  const totalSecs = sel.reduce((a, e) => a + e.secs, 0);
  const hourly = sel.reduce((a, e) => a + (e.secs / 3600) * (e.rate ?? state.cfg.hourly), 0);
  const monthly = rec.reduce((a, r) => a + r.amount, 0);
  const selExpenses = state.expenses.filter(e => e.selected && !e.invoiced);
  const expenseTotal = selExpenses.reduce((a, e) => a + e.amount, 0);
  const totalKm = sel.reduce((a, e) => a + (e.km || 0), 0);
  const kmRate = state.cfg.kmRate ?? 0.57;
  const kmAmount = totalKm * kmRate;
  const subtotal = hourly + monthly + kmAmount + expenseTotal;
  const vatAmount = subtotal * (state.cfg.vat || 0) / 100;
  const invoiceCustomers = [...new Set(sel.map(e => e.customer).filter(Boolean))];
  const primaryCust = invoiceCustomers.length === 1 ? state.cfg.customers.find(c => c.name === invoiceCustomers[0]) : null;
  const maksuehto = primaryCust?.maksuehto ?? 10;
  state.invoices.unshift({
    id: ++state.iId, date: new Date().toISOString(),
    entries: sel.map(e => ({ ...e })), totalSecs, hourly, monthly,
    km: totalKm, kmRate, kmAmount,
    expenses: selExpenses.map(e => ({ ...e })), expenseTotal,
    subtotal, vatAmount, vat: state.cfg.vat || 0,
    total: subtotal + vatAmount, recurring: rec, maksuehto
  });
  sel.forEach(e => { e.invoiced = true; e.selected = false; });
  selExpenses.forEach(e => { e.invoiced = true; e.selected = false; });
  state.filterCustomer = null;
  save(); renderEntries(); renderExpenses();
  toast(t('invoicePrefix') + String(state.iId).padStart(3, '0') + ' arkistoitu');
  goTab('arkisto'); setTimeout(() => renderArchive(state.iId), 80);
}

function isOverdue(inv) {
  if (inv.paid) return false;
  if (inv.maksuehto === 'sopimus') return false;
  const d = new Date(inv.date);
  d.setDate(d.getDate() + (parseInt(inv.maksuehto) || 10));
  d.setHours(23, 59, 59, 999);
  return d < new Date();
}

function updateInvoiceBadge() {
  const badge = document.getElementById('inv-badge');
  if (!badge) return;
  const unpaid = state.invoices.filter(inv => !inv.paid).length;
  if (unpaid === 0) { badge.style.display = 'none'; return; }
  badge.style.display = 'inline-flex';
  badge.textContent = unpaid > 5 ? '5+' : String(unpaid);
}

function markInvoicePaid(id) {
  const inv = state.invoices.find(x => x.id === id);
  if (!inv) return;
  inv.paid = !inv.paid;
  save();
  renderArchive();
  toast(inv.paid ? t('markedPaid') : t('paidRemoved'));
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254 || email.includes(' ')) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local.length || local.length > 64) return false;
  const domainParts = domain.split('.');
  if (domainParts.length < 2 || domainParts.some(p => !p.length)) return false;
  if (domainParts[domainParts.length - 1].length < 2) return false;
  return true;
}

function resolveCustomerEmail(inv) {
  const custs = [...new Set(inv.entries.map(e => e.customer).filter(Boolean))];
  if (!custs.length) return { error: t('noCustomerOnInvoice') };
  if (custs.length > 1) return { error: t('multipleCustomersInvoice') };
  const custObj = state.cfg.customers.find(c => c.name === custs[0]);
  if (!custObj?.sposti) return { error: `${esc(custs[0])} ${t('noCustomerEmail')}` };
  if (!isValidEmail(custObj.sposti)) return { error: `${t('invalidEmailAddr')} ${custObj.sposti}` };
  return { email: custObj.sposti };
}

function openMailto(to, subject, body) {
  const a = document.createElement('a');
  a.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  a.click();
}

function sendInvoiceEmail(id) {
  if (state.isDemo) { toast(t('notAvailableGuest')); return; }
  const inv = state.invoices.find(x => x.id === id);
  if (!inv) return;
  const { email, error } = resolveCustomerEmail(inv);
  if (error) { toast(error); return; }

  const invNum = String(inv.id).padStart(3, '0');
  const maksuehto = inv.maksuehto ?? 10;
  const erapaiva = maksuehto !== 'sopimus' ? calcErapaiva(inv.date, maksuehto) : null;
  const viitenumero = calcViitenumero(inv.id);

  const subject = `Lasku #${invNum}${state.cfg.company ? ' – ' + state.cfg.company : ''}`;

  const payLines = [
    erapaiva ? `Eräpäivä: ${erapaiva}` : 'Maksuehto: Erillisen sopimuksen mukaan',
    state.cfg.tilinumero ? `Tilinumero: ${state.cfg.tilinumero}` : '',
    state.cfg.showViitenumero ? `Viitenumero: ${viitenumero}` : '',
  ].filter(Boolean).join('\n');

  const body = [
    'Hei,',
    '',
    `Lähetän ohessa laskun nro #${invNum}, päivätty ${fmtDate(inv.date)}.`,
    '',
    `Laskun summa: ${fmtEur(inv.total)}`,
    payLines,
    '',
    'Mikäli teillä on kysyttävää laskuun liittyen, ottakaa rohkeasti yhteyttä.',
    '',
    'Ystävällisin terveisin,',
    state.cfg.company || '',
  ].filter(l => l !== undefined).join('\n');

  openMailto(email, subject, body);
}

function sendReminder(id) {
  if (state.isDemo) { toast(t('notAvailableGuest')); return; }
  const inv = state.invoices.find(x => x.id === id);
  if (!inv) return;
  const { email, error } = resolveCustomerEmail(inv);
  if (error) { toast(error); return; }

  const invNum = String(inv.id).padStart(3, '0');
  const maksuehto = inv.maksuehto ?? 10;
  const erapaiva = maksuehto !== 'sopimus' ? calcErapaiva(inv.date, maksuehto) : null;
  const viitenumero = calcViitenumero(inv.id);

  let daysOverdueText = '';
  if (erapaiva) {
    const dueDate = new Date(inv.date);
    dueDate.setDate(dueDate.getDate() + (parseInt(maksuehto) || 10));
    const days = Math.floor((new Date() - dueDate) / (1000 * 60 * 60 * 24));
    if (days > 0) daysOverdueText = ` Eräpäivästä on kulunut ${days} päivää.`;
  }

  const subject = `Maksumuistutus – Lasku #${invNum}`;

  const payLines = [
    erapaiva ? `Eräpäivä: ${erapaiva}` : '',
    state.cfg.tilinumero ? `Tilinumero: ${state.cfg.tilinumero}` : '',
    state.cfg.showViitenumero ? `Viitenumero: ${viitenumero}` : '',
  ].filter(Boolean).join('\n');

  const body = [
    'Hei,',
    '',
    `Huomautan ystävällisesti, että laskumme nro #${invNum}${erapaiva ? ' (eräpäivä ' + erapaiva + ')' : ''} on jäänyt maksamatta.${daysOverdueText}`,
    '',
    `Laskun summa: ${fmtEur(inv.total)}`,
    payLines,
    '',
    'Pyydämme suorittamaan maksun mahdollisimman pian. Mikäli maksu on jo suoritettu, pyydämme jättämään tämän viestin huomiotta.',
    '',
    'Ystävällisin terveisin,',
    state.cfg.company || '',
  ].filter(l => l !== undefined).join('\n');

  openMailto(email, subject, body);
}

export function renderArchive(highlightId) {
  const el = document.getElementById('archive-list');
  updateInvoiceBadge();
  if (!state.invoices.length) { el.innerHTML = `<div class="empty">${t('noInvoices')}</div>`; return; }
  el.innerHTML = state.invoices.map(inv => {
    const isOpen = highlightId === inv.id;
    const overdue = isOverdue(inv);
    const rows = inv.entries.map(e => `
      <div class="inv-row-line">
        <div class="inv-row-left">
          <div class="inv-row-title">${fmtDur(e.secs)}</div>
          <div class="inv-row-sub">${fmtDate(e.date)}${e.customer ? ' · ' + esc(e.customer) : ''}</div>
        </div>
        <div class="inv-row-val">${fmtEur((e.secs / 3600) * (e.rate ?? state.cfg.hourly))}</div>
      </div>`).join('');
    const recRows = inv.recurring.map(r => `
      <div class="inv-row-line">
        <div class="inv-row-left">
          <div class="inv-row-title">${esc(r.name)}</div>
          <div class="inv-row-sub">${t('monthlyCharge')}${r.customer ? ' · ' + esc(r.customer) : ''}</div>
        </div>
        <div class="inv-row-val">${fmtEur(r.amount)}</div>
      </div>`).join('');
    const kmRow = inv.km > 0 ? `
      <div class="inv-row-line">
        <div class="inv-row-left">
          <div class="inv-row-title">${t('kmReimbursement')}</div>
          <div class="inv-row-sub">${inv.km} km × ${String(inv.kmRate ?? 0.57).replace('.', ',')} €/km</div>
        </div>
        <div class="inv-row-val">${fmtEur(inv.kmAmount || 0)}</div>
      </div>` : '';
    const expRows = (inv.expenses || []).map(e => `
      <div class="inv-row-line">
        <div class="inv-row-left">
          <div class="inv-row-title">${esc(e.description)}</div>
          <div class="inv-row-sub">${t('expenseReimbursement')}${e.customer ? ' · ' + esc(e.customer) : ''}</div>
        </div>
        <div class="inv-row-val">${fmtEur(e.amount)}</div>
      </div>`).join('');
    const custs = [...new Set(inv.entries.map(e => e.customer).filter(Boolean))];
    const statusTag = inv.paid
      ? `<div class="inv-tag inv-tag-paid">${t('paid')}</div>`
      : `<div class="inv-tag inv-tag-unpaid">${t('unpaid')}</div>`;
    const overdueText = overdue
      ? `<div class="inv-overdue-text">${t('invoiceOverdue')}</div>`
      : '';
    const paidBtn = inv.paid
      ? `<button class="btn-mark-paid is-paid" style="flex:1;" onclick="markInvoicePaid(${inv.id})">✓ ${t('paid')}</button>`
      : `<button class="btn-mark-paid" style="flex:1;" onclick="markInvoicePaid(${inv.id})">${t('markPaid')}</button>`;
    const reminderBtn = overdue
      ? `<button class="btn-reminder" style="flex:1;" onclick="sendReminder(${inv.id})">${t('sendReminder')}</button>`
      : '';
    return `
      <div class="inv-card">
        <div class="inv-header" onclick="this.nextElementSibling.classList.toggle('open')">
          <div>
            <div class="inv-num">${t('invoicePrefix')}${String(inv.id).padStart(3, '0')}</div>
            <div class="inv-sub">${fmtDate(inv.date)}${custs.length ? ' · ' + custs.map(esc).join(', ') : ''}</div>
            ${overdueText}
          </div>
          <div class="inv-right">
            <div class="inv-total">${fmtEur(inv.total)}</div>
            ${statusTag}
          </div>
        </div>
        <div class="inv-body ${isOpen ? 'open' : ''}">
          <div class="inv-meta">${fmtDate(inv.date)} · ${fmtShort(inv.totalSecs)} h</div>
          ${rows}${recRows}${kmRow}${expRows}
          <div class="inv-subtotals">
            ${inv.vat > 0 ? `
              <div class="inv-subtotal-line"><span>${t('vatExcl')}</span><span>${fmtEur(inv.subtotal)}</span></div>
              <div class="inv-subtotal-line"><span>ALV ${esc(String(inv.vat))}%</span><span>${fmtEur(inv.vatAmount)}</span></div>
            ` : ''}
            <div class="inv-grand">
              <span class="inv-grand-label">${t('grandTotal')}</span>
              <span class="inv-grand-val">${fmtEur(inv.total)}</span>
            </div>
          </div>
          <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
            <button class="btn-outline" style="flex:1;" onclick="printInvoice(${inv.id})">${t('printPdf')}</button>
            <button class="btn-outline" style="flex:1;" onclick="printInvoice(${inv.id},true)">${t('printAttachment')}</button>
            <button class="btn-outline" style="flex:1;" onclick="openEditInvoice(${inv.id})">${t('edit')}</button>
          </div>
          <div style="display:flex;gap:10px;margin-top:10px;">
            <button class="btn-email-inv" style="flex:1;" onclick="sendInvoiceEmail(${inv.id})">${t('sendInvoiceEmail')}</button>
          </div>
          <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;">
            ${paidBtn}
            ${reminderBtn}
          </div>
        </div>
      </div>`;
  }).join('');
}

function printInvoice(id, asAttachment) {
  const inv = state.invoices.find(x => x.id === id);
  if (!inv) return;

  const rows = inv.entries.map(e => `
    <tr>
      <td>${fmtDate(e.date)}</td>
      <td>${fmtEur(e.rate ?? state.cfg.hourly)}</td>
      <td>${fmtHours(e.secs)}</td>
      <td>${esc(e.notes || '—')}</td>
      <td>${fmtEur((e.secs / 3600) * (e.rate ?? state.cfg.hourly))}</td>
    </tr>`).join('');
  const recRows = inv.recurring.map(r => `
    <tr>
      <td>${esc(r.name)}</td>
      <td></td>
      <td></td>
      <td></td>
      <td>${fmtEur(r.amount)}</td>
    </tr>`).join('');
  const kmPrintRow = inv.km > 0 ? `
    <tr>
      <td>${t('kmReimbursement')}</td>
      <td>${String(inv.kmRate ?? 0.57).replace('.', ',')} €/km</td>
      <td>${inv.km} km</td>
      <td></td>
      <td>${fmtEur(inv.kmAmount || 0)}</td>
    </tr>` : '';
  const expPrintRows = (inv.expenses || []).map(e => `
    <tr>
      <td>${esc(e.description)}</td>
      <td>${t('expenseReimbursement')}</td>
      <td></td>
      <td></td>
      <td>${fmtEur(e.amount)}</td>
    </tr>`).join('');

  const custs = [...new Set(inv.entries.map(e => e.customer).filter(Boolean))];
  const primaryCustObj = custs.length === 1 ? state.cfg.customers.find(c => c.name === custs[0]) : null;
  const custAddrLines = primaryCustObj ? [
    primaryCustObj.ytunnus ? 'Y-tunnus: ' + esc(primaryCustObj.ytunnus) : '',
    esc(primaryCustObj.katuosoite || ''),
    [primaryCustObj.postinumero, primaryCustObj.postitoimipaikka].filter(Boolean).map(esc).join(' '),
    esc(primaryCustObj.sposti || ''),
    esc(primaryCustObj.puhelin || ''),
  ].filter(Boolean).map(l => `<div class="cust-addr">${l}</div>`).join('') : '';

  const companyBlock = state.cfg.company ? `
    <div class="company-block">
      <div class="company-name">${esc(state.cfg.company)}</div>
      ${state.cfg.ytunnus ? `<div class="company-detail">Y-tunnus: ${esc(state.cfg.ytunnus)}</div>` : ''}
      ${state.cfg.address ? `<div class="company-detail">${esc(state.cfg.address)}</div>` : ''}
      ${state.cfg.phone ? `<div class="company-detail">${esc(state.cfg.phone)}</div>` : ''}
      ${state.cfg.email ? `<div class="company-detail">${esc(state.cfg.email)}</div>` : ''}
    </div>` : '';

  let headerLeft, paymentBlock;
  if (asAttachment) {
    headerLeft = `
      <h1>Tuntierittely</h1>
      <div class="sub att-date">${fmtDate(inv.date)}</div>
      <div class="inv-customer">${custs.map(esc).join(', ') || '—'}</div>
      ${custAddrLines}`;
    paymentBlock = '';
  } else {
    const maksuehto = inv.maksuehto ?? 10;
    const maksuehtoText = maksuehto === 'sopimus' ? 'Erillisen sopimuksen mukaan' : maksuehto + ' pv';
    const erapaiva = calcErapaiva(inv.date, maksuehto);
    const viitenumero = calcViitenumero(inv.id);
    const showPaymentBox = state.cfg.showErapaiva || state.cfg.showViitenumero || state.cfg.showTilinumero;
    headerLeft = `
      <h1>${t('invoice')} #${String(inv.id).padStart(3, '0')}</h1>
      <div class="sub">${fmtDate(inv.date)}</div>
      <div class="inv-customer">${custs.map(esc).join(', ') || '—'}</div>
      ${custAddrLines}`;
    const payItems = [
      state.cfg.showErapaiva ? `<div><div class="pay-item-label">Maksuehto</div><div class="pay-item-val">${esc(maksuehtoText)}</div></div>` : '',
      state.cfg.showErapaiva && maksuehto !== 'sopimus' ? `<div><div class="pay-item-label">Eräpäivä</div><div class="pay-item-val">${esc(erapaiva)}</div></div>` : '',
      state.cfg.showViitenumero ? `<div><div class="pay-item-label">Viitenumero</div><div class="pay-item-val">${viitenumero}</div></div>` : '',
      state.cfg.showTilinumero && state.cfg.tilinumero ? `<div><div class="pay-item-label">Tilinumero</div><div class="pay-item-val">${esc(state.cfg.tilinumero)}</div></div>` : '',
    ].filter(Boolean).join('');
    paymentBlock = showPaymentBox && payItems ? `<div class="pay-box">${payItems}</div>` : '';
  }

  const title = asAttachment
    ? `Tuntierittely - ${esc(custs.join(', ') || fmtDate(inv.date))}`
    : `Lasku #${String(inv.id).padStart(3, '0')}`;

  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = btoa(String.fromCharCode(...nonceBytes));

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
    <title>${title}</title>
    <style nonce="${nonce}">
      body { font-family: -apple-system, sans-serif; padding: 40px; color: #111; max-width: 760px; margin: 0 auto; }
      h1 { font-size: 20px; font-weight: 700; margin: 0 0 4px 0; line-height: 1; }
      .inv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
      .inv-customer { font-size: 16px; font-weight: 700; color: #111; margin-bottom: 2px; margin-top: 8px; }
      .sub { color: #666; font-size: 14px; }
      .att-date { margin-top: 4px; font-size: 16px; }
      .company-block { text-align: right; }
      .company-name { font-size: 18px; font-weight: 700; margin: 0; line-height: 1.2; }
      .company-detail { font-size: 13px; color: #666; margin-top: 2px; }
      .cust-addr { font-size: 13px; color: #555; line-height: 1.5; }
      .print-btn { padding: 12px 24px; background: #1976D2; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
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
    <div class="inv-header">
      <div>${headerLeft}</div>
      ${companyBlock}
    </div>
    ${paymentBlock}
    <table>
      <thead><tr>
        <th>${t('date')}</th>
        <th>${t('hourlyRate')}</th>
        <th>${t('total')}</th>
        <th>${t('notes')}</th>
        <th>${t('amount')}</th>
      </tr></thead>
      <tbody>${rows}${recRows}${kmPrintRow}${expPrintRows}</tbody>
    </table>
    <div class="total-section">
      ${inv.vat > 0 ? `
        <div class="total-line"><span>${t('vatExcl')}</span><span>${fmtEur(inv.subtotal)}</span></div>
        <div class="total-line"><span>ALV ${esc(String(inv.vat))}%</span><span>${fmtEur(inv.vatAmount)}</span></div>
      ` : ''}
      <div class="grand">
        <span class="grand-label">${t('grandTotal')}</span>
        <span class="grand-val">${fmtEur(inv.total)}</span>
      </div>
    </div>
    <br><button id="print-btn" class="print-btn">🖨 ${t('printPdf')}</button>
    <script nonce="${nonce}">document.getElementById('print-btn').addEventListener('click',function(){window.print();})</script>
  </body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) win.addEventListener('load', () => URL.revokeObjectURL(url));
  else URL.revokeObjectURL(url);
}

// ── EDIT INVOICE ──
function openEditInvoice(id) {
  const inv = state.invoices.find(x => x.id === id);
  if (!inv) return;
  state.editingInvId = id;
  const el = document.getElementById('edit-inv-entries');
  el.innerHTML = inv.entries.map((e, i) => `
    <div style="background:var(--bg);border-radius:var(--r-sm);padding:12px;margin-bottom:10px;">
      <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px;">${fmtDate(e.date)} · ${esc(e.customer || '—')}</div>
      <div style="display:flex;gap:8px;margin-bottom:6px;">
        <div class="fg" style="flex:1;margin:0;"><label>Tunnit</label><input type="number" id="einv-h-${i}" value="${Math.floor(e.secs / 3600)}" min="0" max="24"></div>
        <div class="fg" style="flex:1;margin:0;"><label>Minuutit</label><input type="number" id="einv-m-${i}" value="${Math.floor((e.secs % 3600) / 60)}" min="0" max="59"></div>
      </div>
      <div class="fg" style="margin:0;"><label>Merkintöjä</label><input type="text" id="einv-notes-${i}" value="${esc(e.notes || '')}" placeholder="Merkintä..."></div>
    </div>
  `).join('');
  document.getElementById('modal-edit-inv').classList.add('open');
}

function saveEditInvoice() {
  const inv = state.invoices.find(x => x.id === state.editingInvId);
  if (!inv) return;
  inv.entries.forEach((e, i) => {
    const h = parseInt(document.getElementById(`einv-h-${i}`).value) || 0;
    const m = parseInt(document.getElementById(`einv-m-${i}`).value) || 0;
    e.secs = h * 3600 + m * 60;
    e.notes = document.getElementById(`einv-notes-${i}`).value.trim();
  });
  const totalSecs = inv.entries.reduce((a, e) => a + e.secs, 0);
  const hourly = inv.entries.reduce((a, e) => a + (e.secs / 3600) * (e.rate ?? state.cfg.hourly), 0);
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
  state.editingInvId = null;
}

window.printInvoice = printInvoice;
window.openEditInvoice = openEditInvoice;
window.saveEditInvoice = saveEditInvoice;
window.closeEditInvModal = closeEditInvModal;
window.finishInvoice = finishInvoice;
window.closeModal = closeModal;
window.startInvoice = startInvoice;
window.markInvoicePaid = markInvoicePaid;
window.sendInvoiceEmail = sendInvoiceEmail;
window.sendReminder = sendReminder;
window.updateInvoiceBadge = updateInvoiceBadge;

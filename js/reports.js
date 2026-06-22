import { state } from './state.js';
import { t } from './i18n.js';
import { fmtDate, fmtEur, fmtShort, fmtHours, esc } from './utils.js';

const PALETTE = [
  '#1976D2', '#43A047', '#E53935', '#FB8C00', '#8E24AA',
  '#00ACC1', '#F4511E', '#039BE5', '#7CB342', '#D81B60',
  '#5E35B1', '#00897B',
];

const MONTHS = ['Tam', 'Hel', 'Maa', 'Huh', 'Tou', 'Kes', 'Hei', 'Elo', 'Syy', 'Lok', 'Mar', 'Jou'];
const MONTH_NAMES = [
  'Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu', 'Toukokuu', 'Kesäkuu',
  'Heinäkuu', 'Elokuu', 'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu',
];

let reportYear = new Date().getFullYear();

function yearInvoices() {
  return state.invoices.filter(inv => new Date(inv.date).getFullYear() === reportYear);
}

function custKey(inv) {
  const custs = [...new Set(inv.entries.map(e => e.customer).filter(Boolean))];
  return custs.length ? custs.join(', ') : '—';
}

function sizeCanvas(id, w, h) {
  const canvas = document.getElementById(id);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, W: w, H: h };
}

export function renderReports() {
  document.getElementById('report-year').textContent = reportYear;
  document.getElementById('btn-dl-year').textContent = `↓ Vuosiraportti ${reportYear}`;
  const sel = document.getElementById('rep-month-sel');
  if (sel && !sel.dataset.userChanged) {
    const curM = reportYear === new Date().getFullYear() ? new Date().getMonth() : 0;
    sel.value = curM;
  }
  const invs = yearInvoices();
  renderCustomerSummary(invs);
  drawPie(invs);
  drawBars(invs);
}

function renderCustomerSummary(invs) {
  const el = document.getElementById('report-customers');
  if (!invs.length) {
    el.innerHTML = `<div style="padding:10px 0;color:var(--text3);font-size:14px;">${t('noInvoicesYear')} ${reportYear}.</div>`;
    return;
  }
  const map = {};
  for (const inv of invs) {
    const key = custKey(inv);
    if (!map[key]) map[key] = { total: 0, secs: 0, count: 0 };
    map[key].total += inv.total;
    map[key].secs += inv.totalSecs;
    map[key].count++;
  }
  const entries = Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  const grandTotal = entries.reduce((a, [, v]) => a + v.total, 0);

  el.innerHTML = entries.map(([name, v], i) => `
    <div class="rep-row">
      <span class="rep-dot" style="background:${PALETTE[i % PALETTE.length]}"></span>
      <div class="rep-info">
        <div class="rep-name">${name}</div>
        <div class="rep-sub">${v.count} lasku${v.count !== 1 ? 'a' : ''} · ${fmtShort(v.secs)} h</div>
      </div>
      <div class="rep-val">${fmtEur(v.total)}</div>
    </div>
  `).join('') + `
    <div class="rep-grand">
      <span>Yhteensä ${reportYear}</span>
      <span>${fmtEur(grandTotal)}</span>
    </div>
  `;
}

function drawPie(invs) {
  const wrap = document.getElementById('chart-pie-wrap');
  const size = Math.min(wrap.clientWidth, 220);
  const { ctx, W, H } = sizeCanvas('chart-pie', size, size);
  const legend = document.getElementById('chart-pie-legend');

  const map = {};
  for (const inv of invs) {
    const key = custKey(inv);
    map[key] = (map[key] || 0) + inv.totalSecs;
  }
  const data = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const total = data.reduce((a, [, v]) => a + v, 0);
  const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 8;

  ctx.clearRect(0, 0, W, H);

  if (!total) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.fillStyle = '#e8e8e8';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.52, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    legend.innerHTML = '';
    return;
  }

  let angle = -Math.PI / 2;
  data.forEach(([, val], i) => {
    const sweep = (val / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.closePath();
    ctx.fillStyle = PALETTE[i % PALETTE.length];
    ctx.fill();
    angle += sweep;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.52, 0, 2 * Math.PI);
  ctx.fillStyle = '#fff';
  ctx.fill();

  ctx.fillStyle = '#111';
  ctx.font = `bold ${Math.round(size * 0.065)}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fmtShort(total) + ' h', cx, cy);

  legend.innerHTML = data.map(([name, val], i) => `
    <div class="pie-leg">
      <span class="pie-leg-dot" style="background:${PALETTE[i % PALETTE.length]}"></span>
      <span class="pie-leg-name">${name}</span>
      <span class="pie-leg-val">${fmtShort(val)} h</span>
    </div>
  `).join('');
}

function drawBars(invs) {
  const wrap = document.getElementById('chart-bars-wrap');
  const W = wrap.clientWidth;
  const H = 180;
  const { ctx } = sizeCanvas('chart-bars', W, H);

  const months = Array(12).fill(0);
  for (const inv of invs) {
    months[new Date(inv.date).getMonth()] += inv.total;
  }

  const pt = 14, pb = 30, pl = 48, pr = 8;
  const cW = W - pl - pr;
  const cH = H - pt - pb;
  const maxVal = Math.max(...months, 100);
  const slot = cW / 12;
  const bW = Math.max(slot * 0.6, 4);

  ctx.font = '10px -apple-system, sans-serif';
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const y = pt + cH - (i / steps) * cH;
    const val = (i / steps) * maxVal;
    ctx.strokeStyle = 'rgba(0,0,0,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(W - pr, y); ctx.stroke();
    ctx.fillStyle = '#070707';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const label = val >= 1000 ? (val / 1000).toFixed(val >= 10000 ? 0 : 1) + 'k' : Math.round(val).toString();
    ctx.fillText(label + '€', pl - 4, y);
  }

  const now = new Date();
  months.forEach((val, i) => {
    const x = pl + i * slot + (slot - bW) / 2;
    const bH = val > 0 ? Math.max((val / maxVal) * cH, 3) : 3;
    const y = pt + cH - bH;
    const isCurrent = reportYear === now.getFullYear() && i === now.getMonth();

    ctx.fillStyle = val > 0 ? (isCurrent ? '#1565C0' : '#1976D2') : '#e8e8e8';
    ctx.fillRect(x, y, bW, bH);

    ctx.fillStyle = isCurrent ? '#1565C0' : '#505050';
    ctx.font = isCurrent ? 'bold 9px -apple-system, sans-serif' : '9px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(MONTHS[i], x + bW / 2, H - pb + 4);
  });
}

function reportPrevYear() { reportYear--; renderReports(); }
function reportNextYear() { reportYear = Math.min(reportYear + 1, new Date().getFullYear()); renderReports(); }

// ── RAPORTTIEN LATAUS ──

function reportStyles(nonce) {
  return `<style nonce="${nonce}">
    body{font-family:-apple-system,Arial,sans-serif;padding:32px 40px;color:#111;max-width:920px;margin:0 auto;font-size:14px;}
    h1{font-size:22px;font-weight:800;margin:0 0 4px;}
    h2{font-size:13px;font-weight:700;margin:28px 0 8px;border-bottom:2px solid #111;padding-bottom:5px;text-transform:uppercase;letter-spacing:.05em;color:#444;}
    .rep-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;}
    .company-name{font-size:17px;font-weight:700;}
    .meta{font-size:12px;color:#666;margin-top:3px;}
    table{width:100%;border-collapse:collapse;margin-bottom:4px;}
    th{text-align:left;padding:6px 8px;border-bottom:1.5px solid #111;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#555;}
    td{padding:8px 8px;border-bottom:1px solid #ebebeb;vertical-align:top;}
    .num{text-align:right;}
    .total-row td{font-weight:700;border-top:2px solid #111;border-bottom:none;padding-top:10px;}
    .tag{padding:2px 7px;border-radius:10px;font-size:11px;font-weight:600;}
    .tag-paid{background:#d0f5e0;color:#1a7a40;}
    .tag-unpaid{background:#f0f0f0;color:#666;}
    .tag-open{background:#fff3e0;color:#e65100;}
    .tag-inv{background:#e3f0fc;color:#1256a0;}
    .summary{display:flex;gap:20px;background:#f5f5f5;border-radius:8px;padding:16px 20px;margin-bottom:20px;flex-wrap:wrap;}
    .sum-item{flex:1;min-width:110px;}
    .sum-label{font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;}
    .sum-val{font-size:20px;font-weight:800;}
    .sum-sub{font-size:12px;color:#666;margin-top:2px;}
    .print-btn{padding:11px 22px;background:#1976D2;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-top:28px;}
    @media print{.print-btn{display:none;}}
  </style>`;
}

function companyHeader() {
  if (!state.cfg.company) return '';
  return `<div style="text-align:right;">
    <div class="company-name">${esc(state.cfg.company)}</div>
    ${state.cfg.ytunnus ? `<div class="meta">Y-tunnus: ${esc(state.cfg.ytunnus)}</div>` : ''}
    ${state.cfg.email ? `<div class="meta">${esc(state.cfg.email)}</div>` : ''}
  </div>`;
}

function openReport(html, title) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) win.addEventListener('load', () => URL.revokeObjectURL(url));
  else URL.revokeObjectURL(url);
}

function nonce() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

function downloadYearReport() {
  const year = reportYear;
  const invs = state.invoices.filter(inv => new Date(inv.date).getFullYear() === year);
  const allEntries = state.entries.filter(e => new Date(e.date).getFullYear() === year);
  const allExpenses = state.expenses.filter(e => new Date(e.date).getFullYear() === year);

  const monthlyData = Array(12).fill(null).map(() => ({ secs: 0, invoiced: 0, count: 0 }));
  for (const inv of invs) {
    const m = new Date(inv.date).getMonth();
    monthlyData[m].invoiced += inv.total;
    monthlyData[m].count++;
  }
  for (const e of allEntries) {
    monthlyData[new Date(e.date).getMonth()].secs += e.secs;
  }

  const totalInvoiced = invs.reduce((a, i) => a + i.total, 0);
  const totalSecs = allEntries.reduce((a, e) => a + e.secs, 0);
  const openSecs = allEntries.filter(e => !e.invoiced).reduce((a, e) => a + e.secs, 0);
  const totalExpenses = allExpenses.reduce((a, e) => a + e.amount, 0);
  const paidTotal = invs.filter(i => i.paid).reduce((a, i) => a + i.total, 0);
  const unpaidTotal = invs.filter(i => !i.paid).reduce((a, i) => a + i.total, 0);

  const custMap = {};
  for (const inv of invs) {
    const key = custKey(inv);
    if (!custMap[key]) custMap[key] = { total: 0, secs: 0, count: 0 };
    custMap[key].total += inv.total;
    custMap[key].secs += inv.totalSecs;
    custMap[key].count++;
  }

  const nc = nonce();

  const monthRows = monthlyData.map((d, i) => (d.invoiced > 0 || d.secs > 0) ? `
    <tr>
      <td>${MONTH_NAMES[i]}</td>
      <td class="num">${d.count || '—'}</td>
      <td class="num">${d.secs > 0 ? fmtShort(d.secs) + ' h' : '—'}</td>
      <td class="num">${d.invoiced > 0 ? fmtEur(d.invoiced) : '—'}</td>
    </tr>` : '').join('');

  const custRows = Object.entries(custMap).sort((a, b) => b[1].total - a[1].total).map(([name, v]) => `
    <tr>
      <td>${esc(name)}</td>
      <td class="num">${v.count}</td>
      <td class="num">${fmtShort(v.secs)} h</td>
      <td class="num">${fmtEur(v.total)}</td>
    </tr>`).join('');

  const invRows = invs.map(inv => {
    const custs = [...new Set(inv.entries.map(e => e.customer).filter(Boolean))];
    return `<tr>
      <td>Lasku #${String(inv.id).padStart(3, '0')}</td>
      <td>${fmtDate(inv.date)}</td>
      <td>${custs.map(esc).join(', ') || '—'}</td>
      <td class="num">${fmtShort(inv.totalSecs)} h</td>
      <td class="num">${fmtEur(inv.total)}</td>
      <td><span class="tag ${inv.paid ? 'tag-paid' : 'tag-unpaid'}">${inv.paid ? 'Maksettu' : 'Maksamatta'}</span></td>
    </tr>`;
  }).join('');

  const openEntries = allEntries.filter(e => !e.invoiced);
  const openRows = openEntries.map(e => `
    <tr>
      <td>${fmtDate(e.date)}</td>
      <td>${esc(e.customer || '—')}</td>
      <td class="num">${fmtHours(e.secs)}</td>
      <td class="num">${fmtEur((e.secs / 3600) * (e.rate ?? state.cfg.hourly))}</td>
      <td style="font-size:12px;color:#666;">${esc(e.notes || '')}</td>
    </tr>`).join('');

  const expRows = allExpenses.map(e => `
    <tr>
      <td>${fmtDate(e.date)}</td>
      <td>${esc(e.description)}</td>
      <td>${esc(e.customer || '—')}</td>
      <td class="num">${fmtEur(e.amount)}</td>
      <td><span class="tag ${e.invoiced ? 'tag-inv' : 'tag-open'}">${e.invoiced ? 'Laskutettu' : 'Avoin'}</span></td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="fi"><head><meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nc}'; script-src 'nonce-${nc}';">
    <title>Vuosiraportti ${year}</title>
    ${reportStyles(nc)}
  </head><body>
    <div class="rep-header">
      <div>
        <h1>Vuosiraportti ${year}</h1>
        <div class="meta">Luotu ${fmtDate(new Date())}</div>
      </div>
      ${companyHeader()}
    </div>

    <div class="summary">
      <div class="sum-item">
        <div class="sum-label">Laskutettu</div>
        <div class="sum-val">${fmtEur(totalInvoiced)}</div>
        <div class="sum-sub">${invs.length} laskua · maksettu ${fmtEur(paidTotal)}</div>
      </div>
      <div class="sum-item">
        <div class="sum-label">Tunnit</div>
        <div class="sum-val">${fmtShort(totalSecs)} h</div>
        ${openSecs > 0 ? `<div class="sum-sub">Laskuttamatta: ${fmtShort(openSecs)} h</div>` : '<div class="sum-sub">Kaikki laskutettu</div>'}
      </div>
      ${unpaidTotal > 0 ? `<div class="sum-item">
        <div class="sum-label">Maksamatta</div>
        <div class="sum-val" style="color:#c62828;">${fmtEur(unpaidTotal)}</div>
        <div class="sum-sub">${invs.filter(i => !i.paid).length} laskua</div>
      </div>` : ''}
      ${totalExpenses > 0 ? `<div class="sum-item">
        <div class="sum-label">Kulut</div>
        <div class="sum-val">${fmtEur(totalExpenses)}</div>
        <div class="sum-sub">${allExpenses.length} kuittiä</div>
      </div>` : ''}
    </div>

    <h2>Kuukausittainen erittely</h2>
    <table>
      <thead><tr><th>Kuukausi</th><th class="num">Laskuja</th><th class="num">Tunnit</th><th class="num">Laskutettu</th></tr></thead>
      <tbody>
        ${monthRows || '<tr><td colspan="4" style="color:#aaa;padding:10px 8px;">Ei toimintaa</td></tr>'}
        <tr class="total-row"><td>Yhteensä ${year}</td><td class="num">${invs.length}</td><td class="num">${fmtShort(totalSecs)} h</td><td class="num">${fmtEur(totalInvoiced)}</td></tr>
      </tbody>
    </table>

    ${Object.keys(custMap).length > 0 ? `
    <h2>Asiakaskohtainen yhteenveto</h2>
    <table>
      <thead><tr><th>Asiakas</th><th class="num">Laskuja</th><th class="num">Tunnit</th><th class="num">Laskutettu</th></tr></thead>
      <tbody>${custRows}</tbody>
    </table>` : ''}

    ${invs.length > 0 ? `
    <h2>Laskut</h2>
    <table>
      <thead><tr><th>Numero</th><th>Päivämäärä</th><th>Asiakas</th><th class="num">Tunnit</th><th class="num">Summa</th><th>Tila</th></tr></thead>
      <tbody>${invRows}</tbody>
    </table>` : ''}

    ${openEntries.length > 0 ? `
    <h2>Laskuttamattomat kirjaukset</h2>
    <table>
      <thead><tr><th>Päivämäärä</th><th>Asiakas</th><th class="num">Tunnit</th><th class="num">Arvo</th><th>Merkintöjä</th></tr></thead>
      <tbody>${openRows}</tbody>
    </table>` : ''}

    ${allExpenses.length > 0 ? `
    <h2>Kulukorvaukset</h2>
    <table>
      <thead><tr><th>Päivämäärä</th><th>Kuvaus</th><th>Asiakas</th><th class="num">Summa</th><th>Tila</th></tr></thead>
      <tbody>${expRows}</tbody>
    </table>` : ''}

    <button class="print-btn" id="pbtn">🖨 Tulosta / Tallenna PDF</button>
    <script nonce="${nc}">document.getElementById('pbtn').addEventListener('click',()=>window.print())</script>
  </body></html>`;

  openReport(html, `Vuosiraportti ${year}`);
}

function downloadMonthReport() {
  const sel = document.getElementById('rep-month-sel');
  const month = parseInt(sel.value);
  const year = reportYear;
  const monthName = MONTH_NAMES[month];

  const invs = state.invoices.filter(inv => {
    const d = new Date(inv.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const allEntries = state.entries.filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const allExpenses = state.expenses.filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const totalSecs = allEntries.reduce((a, e) => a + e.secs, 0);
  const totalVal = allEntries.reduce((a, e) => a + (e.secs / 3600) * (e.rate ?? state.cfg.hourly), 0);
  const totalInvoiced = invs.reduce((a, i) => a + i.total, 0);
  const totalExpenses = allExpenses.reduce((a, e) => a + e.amount, 0);
  const openSecs = allEntries.filter(e => !e.invoiced).reduce((a, e) => a + e.secs, 0);

  const nc = nonce();

  const entryRows = allEntries.map(e => `
    <tr>
      <td>${fmtDate(e.date)}</td>
      <td>${esc(e.customer || '—')}</td>
      <td class="num">${fmtHours(e.secs)}</td>
      <td class="num">${fmtEur(e.rate ?? state.cfg.hourly)}/h</td>
      <td class="num">${fmtEur((e.secs / 3600) * (e.rate ?? state.cfg.hourly))}</td>
      <td><span class="tag ${e.invoiced ? 'tag-inv' : 'tag-open'}">${e.invoiced ? 'Laskutettu' : 'Avoin'}</span></td>
      <td style="font-size:12px;color:#666;">${esc(e.notes || '')}</td>
    </tr>`).join('');

  const invRows = invs.map(inv => {
    const custs = [...new Set(inv.entries.map(e => e.customer).filter(Boolean))];
    return `<tr>
      <td>Lasku #${String(inv.id).padStart(3, '0')}</td>
      <td>${fmtDate(inv.date)}</td>
      <td>${custs.map(esc).join(', ') || '—'}</td>
      <td class="num">${fmtEur(inv.total)}</td>
      <td><span class="tag ${inv.paid ? 'tag-paid' : 'tag-unpaid'}">${inv.paid ? 'Maksettu' : 'Maksamatta'}</span></td>
    </tr>`;
  }).join('');

  const expRows = allExpenses.map(e => `
    <tr>
      <td>${fmtDate(e.date)}</td>
      <td>${esc(e.description)}</td>
      <td>${esc(e.customer || '—')}</td>
      <td class="num">${fmtEur(e.amount)}</td>
      <td><span class="tag ${e.invoiced ? 'tag-inv' : 'tag-open'}">${e.invoiced ? 'Laskutettu' : 'Avoin'}</span></td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="fi"><head><meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nc}'; script-src 'nonce-${nc}';">
    <title>${monthName} ${year}</title>
    ${reportStyles(nc)}
  </head><body>
    <div class="rep-header">
      <div>
        <h1>${monthName} ${year}</h1>
        <div class="meta">Luotu ${fmtDate(new Date())}</div>
      </div>
      ${companyHeader()}
    </div>

    <div class="summary">
      <div class="sum-item">
        <div class="sum-label">Tunnit</div>
        <div class="sum-val">${fmtShort(totalSecs)} h</div>
        <div class="sum-sub">${openSecs > 0 ? 'Laskuttamatta: ' + fmtShort(openSecs) + ' h' : 'Arvo: ' + fmtEur(totalVal)}</div>
      </div>
      <div class="sum-item">
        <div class="sum-label">Laskutettu</div>
        <div class="sum-val">${fmtEur(totalInvoiced)}</div>
        <div class="sum-sub">${invs.length} laskua</div>
      </div>
      ${totalExpenses > 0 ? `<div class="sum-item">
        <div class="sum-label">Kulut</div>
        <div class="sum-val">${fmtEur(totalExpenses)}</div>
      </div>` : ''}
    </div>

    ${allEntries.length > 0 ? `
    <h2>Kirjaukset</h2>
    <table>
      <thead><tr><th>Päivämäärä</th><th>Asiakas</th><th class="num">Tunnit</th><th class="num">Hinta</th><th class="num">Summa</th><th>Tila</th><th>Merkintöjä</th></tr></thead>
      <tbody>
        ${entryRows}
        <tr class="total-row">
          <td colspan="2">Yhteensä</td>
          <td class="num">${fmtShort(totalSecs)} h</td>
          <td></td>
          <td class="num">${fmtEur(totalVal)}</td>
          <td colspan="2"></td>
        </tr>
      </tbody>
    </table>` : `<p style="color:#999;margin:16px 0;">Ei kirjauksia ${monthName.toLowerCase()}ssa ${year}.</p>`}

    ${invs.length > 0 ? `
    <h2>Laskut</h2>
    <table>
      <thead><tr><th>Numero</th><th>Päivämäärä</th><th>Asiakas</th><th class="num">Summa</th><th>Tila</th></tr></thead>
      <tbody>${invRows}</tbody>
    </table>` : ''}

    ${allExpenses.length > 0 ? `
    <h2>Kulukorvaukset</h2>
    <table>
      <thead><tr><th>Päivämäärä</th><th>Kuvaus</th><th>Asiakas</th><th class="num">Summa</th><th>Tila</th></tr></thead>
      <tbody>${expRows}</tbody>
    </table>` : ''}

    <button class="print-btn" id="pbtn">🖨 Tulosta / Tallenna PDF</button>
    <script nonce="${nc}">document.getElementById('pbtn').addEventListener('click',()=>window.print())</script>
  </body></html>`;

  openReport(html, `${monthName} ${year}`);
}

window.reportPrevYear = reportPrevYear;
window.reportNextYear = reportNextYear;
window.downloadYearReport = downloadYearReport;
window.downloadMonthReport = downloadMonthReport;

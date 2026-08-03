import { state } from './state.js';
import { t } from './i18n.js';
import { fmtDate, fmtEur, fmtShort, fmtHours, esc } from './utils.js';
import { customerName } from './customers.js';

const PALETTE = [
  '#1976D2', '#43A047', '#E53935', '#FB8C00', '#8E24AA',
  '#00ACC1', '#F4511E', '#039BE5', '#7CB342', '#D81B60',
  '#5E35B1', '#00897B',
];

const months = () => t('monthNamesShort');
const monthNames = () => t('monthNames');

let reportYear = new Date().getFullYear();
// Independent per section — toggling VAT in one card must not affect the
// other, they just happened to share one flag before.
let showVatCustomers = false;
let showVatMonthly = false;

function toggleReportVat(which) {
  if (which === 'monthly') showVatMonthly = !showVatMonthly;
  else showVatCustomers = !showVatCustomers;
  renderReports();
}

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

// Canvas charts are sized from the wrap's clientWidth at draw time, so they
// go stale when the window is resized (desktop) rather than reloaded — redraw
// them, debounced, whenever that happens and the Raportit view is showing.
let resizeRedrawTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeRedrawTimer);
  resizeRedrawTimer = setTimeout(() => {
    if (document.getElementById('subpanel-raportit')?.classList.contains('active')) renderReports();
  }, 150);
});

function reportYearOptions() {
  const years = new Set([reportYear, new Date().getFullYear()]);
  state.invoices.forEach(inv => years.add(new Date(inv.date).getFullYear()));
  state.entries.forEach(e => years.add(new Date(e.date).getFullYear()));
  return [...years].sort((a, b) => b - a);
}

function setReportYear(y) {
  reportYear = parseInt(y, 10);
  renderReports();
}

export function renderReports() {
  const yearSel = document.getElementById('rep-year-sel');
  if (yearSel) {
    yearSel.innerHTML = reportYearOptions().map(y => `<option value="${y}"${y === reportYear ? ' selected' : ''}>${y}</option>`).join('');
  }
  document.getElementById('rep-year-title-btn').textContent = `${t('yearReport')}`;
  const btnVatCust = document.getElementById('btn-toggle-vat');
  if (btnVatCust) btnVatCust.textContent = showVatCustomers ? t('hideVat') : t('showVat');
  const btnVatMonth = document.getElementById('btn-toggle-vat-2');
  if (btnVatMonth) btnVatMonth.textContent = showVatMonthly ? t('hideVat') : t('showVat');
  const sel = document.getElementById('rep-month-sel');
  if (sel) {
    // Future months of the current year have no data yet, so they're not
    // offered — the list only goes up to the current month.
    const now = new Date();
    const maxMonth = reportYear === now.getFullYear() ? now.getMonth() : 11;
    const prev = sel.dataset.userChanged ? parseInt(sel.value) : (reportYear === now.getFullYear() ? now.getMonth() : 0);
    sel.innerHTML = monthNames().slice(0, maxMonth + 1).map((n, i) => `<option value="${i}"${i === prev ? ' selected' : ''}>${n}</option>`).join('');
    if (sel.dataset.userChanged) sel.value = Math.min(prev, maxMonth);
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
    if (!map[key]) map[key] = { net: 0, vat: 0, secs: 0, count: 0 };
    map[key].net += inv.subtotal ?? inv.total;
    map[key].vat += inv.vatAmount ?? 0;
    map[key].secs += inv.totalSecs;
    map[key].count++;
  }
  const entries = Object.entries(map).sort((a, b) => (b[1].net + b[1].vat) - (a[1].net + a[1].vat));
  const grandNet = entries.reduce((a, [, v]) => a + v.net, 0);
  const grandVat = entries.reduce((a, [, v]) => a + v.vat, 0);

  const vatNote = (v) => showVatCustomers && v.net > 0
    ? `<div class="rep-vat-note">${t('vatIncl')} ${fmtEur(v.vat)}</div>` : '';

  el.innerHTML = entries.map(([name, v], i) => `
    <div class="rep-row">
      <span class="rep-dot" style="background:${PALETTE[i % PALETTE.length]}"></span>
      <div class="rep-info">
        <div class="rep-name">${name}</div>
        <div class="rep-sub">${v.count} ${v.count !== 1 ? t('invoiceSuffix') : t('invoiceSuffix1')} · ${fmtShort(v.secs)} h</div>
      </div>
      <div class="rep-val-wrap">
        <div class="rep-val">${fmtEur(showVatCustomers ? v.net + v.vat : v.net)}</div>
        ${vatNote(v)}
      </div>
    </div>
  `).join('') + `
    <div class="rep-grand">
      <span>${t('totalRow')} ${reportYear}</span>
      <div class="rep-val-wrap">
        <span>${fmtEur(showVatCustomers ? grandNet + grandVat : grandNet)}</span>
        ${vatNote({ net: grandNet, vat: grandVat })}
      </div>
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

// Axis gridline labels stay compact (k€ shorthand); the labels drawn inside
// each bar segment show the precise sum instead.
function chartAxisLabel(val) {
  return (val >= 1000 ? (val / 1000).toFixed(val >= 10000 ? 0 : 1) + 'k' : Math.round(val).toString()) + '€';
}
function chartValLabel(val) {
  return Math.round(val).toLocaleString('fi-FI') + ' €';
}
// Net by default; with "Näytä ALV" on, val is already gross (net+vat — see
// monthlyTotals below), so the vat portion is appended in parentheses
// rather than shown as a separately-positioned label.
function barValueLabel(val, vat) {
  return showVatMonthly && vat > 0 ? `${chartValLabel(val)} (${chartValLabel(vat)})` : chartValLabel(val);
}

// Y-axis gridline spacing — "nice" round numbers rather than an arbitrary
// 1/4-of-max split, so the axis reads the way you'd sketch it by hand.
function niceStep(maxVal) {
  const table = [
    [2000, 500], [4000, 1000], [6000, 1500], [8000, 2000],
    [10000, 2500], [20000, 5000], [40000, 10000],
  ];
  for (const [limit, step] of table) {
    if (maxVal <= limit) return step;
  }
  // Beyond the table, keep doubling both the limit and its step.
  let limit = 40000, step = 10000;
  while (maxVal > limit) { limit *= 2; step *= 2; }
  return step;
}

// null = automatic (screen-width based); 'horizontal'/'vertical' once the
// user has manually flipped it via the rotate button, overriding the width
// check until they flip it again.
let chartOrientationOverride = null;

function toggleChartOrientation() {
  const wrap = document.getElementById('chart-bars-wrap');
  const current = chartOrientationOverride || (wrap.clientWidth < 480 ? 'horizontal' : 'vertical');
  chartOrientationOverride = current === 'horizontal' ? 'vertical' : 'horizontal';
  renderReports();
}

function drawBars(invs) {
  const wrap = document.getElementById('chart-bars-wrap');
  const W = wrap.clientWidth;

  const monthlyNet = Array(12).fill(0);
  const monthlyVat = Array(12).fill(0);
  for (const inv of invs) {
    const m = new Date(inv.date).getMonth();
    monthlyNet[m] += inv.subtotal ?? inv.total;
    monthlyVat[m] += inv.vatAmount ?? 0;
  }
  const monthlyTotals = monthlyNet.map((net, i) => showVatMonthly ? net + monthlyVat[i] : net);
  const maxVal = Math.max(...monthlyTotals, 100);
  const step = niceStep(maxVal);
  const axisTop = Math.ceil(maxVal / step) * step;
  const numSteps = axisTop / step;
  const dark = document.documentElement.dataset.theme === 'dark';

  // Below phone width, vertical bars leave so little room per month that
  // every label has to rotate to fit. Turning the whole chart on its side
  // — money axis along the top, months down the left — gives every label
  // (both axes, both value labels) all the horizontal room it needs to
  // read normally, since rows stack top-to-bottom instead of competing for
  // side-by-side width. Wide screens keep the familiar vertical layout,
  // unless the user has manually flipped it with the rotate button.
  const horizontal = chartOrientationOverride ? chartOrientationOverride === 'horizontal' : W < 480;
  if (horizontal) {
    drawBarsHorizontal(W, monthlyNet, monthlyVat, monthlyTotals, axisTop, step, numSteps, dark);
  } else {
    drawBarsVertical(W, monthlyNet, monthlyVat, monthlyTotals, axisTop, step, numSteps, dark);
  }
}

function drawBarsVertical(W, monthlyNet, monthlyVat, monthlyTotals, axisTop, step, numSteps, dark) {
  const H = 280;
  const { ctx } = sizeCanvas('chart-bars', W, H);

  const rotatedValFont = '9px -apple-system, sans-serif';
  const valFont = '11px -apple-system, sans-serif';

  ctx.font = valFont;
  const axisLabelWidth = ctx.measureText(chartAxisLabel(axisTop)).width;
  // Price-only width — once rendered, the ALV portion sits on its own line
  // next to the price (see the render loop) rather than appended inline, so
  // it no longer factors into whether the label fits its slot.
  const priceLabelWidth = Math.max(0, ...monthlyTotals.map(v => v > 0 ? ctx.measureText(chartValLabel(v)).width : 0));

  const pl = Math.ceil(axisLabelWidth) + 14, pr = 8;
  const cW = W - pl - pr;
  const slot = cW / 12;
  const bW = Math.max(slot * 0.6, 4);
  // A horizontal label only fits without colliding into its neighbour if
  // it's narrower than its own slot — true on desktop-width charts, not on
  // phone-width ones. When it doesn't fit, rotate it (reads bottom-to-top)
  // so it only needs ~11px of horizontal room instead of the full string.
  const rotateValLabel = priceLabelWidth > slot - 4;
  const hasVatLine = !rotateValLabel && showVatMonthly && monthlyVat.some(v => v > 0);

  // Rotated rendering draws the old combined "price (vat)" string (see
  // below) at a smaller font than the normal case — narrow screens are
  // exactly where this branch fires, so keeping it compact leaves more of
  // the fixed canvas height for the bars themselves instead of the label.
  ctx.font = rotatedValFont;
  const combinedLabelWidth = Math.max(0, ...monthlyTotals.map((v, i) => v > 0 ? ctx.measureText(barValueLabel(v, monthlyVat[i])).width : 0));
  ctx.font = valFont;

  // Both rotated and non-rotated price (+ optional vat) labels sit above
  // their own bar now, so headroom lives at the top; the rotated case needs
  // more of it since its label reads sideways along that same vertical
  // space instead of stacking as short horizontal lines.
  const pt = 24 + (priceLabelWidth > 0 ? (rotateValLabel ? combinedLabelWidth + 4 : (hasVatLine ? 30 : 16)) : 0);
  const pb = 24;
  const cH = H - pt - pb;

  for (let i = 0; i <= numSteps; i++) {
    const val = i * step;
    const y = pt + cH - (val / axisTop) * cH;
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(W - pr, y); ctx.stroke();
    ctx.fillStyle = dark ? '#f2f2f2' : '#070707';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(chartAxisLabel(val), pl - 4, y);
  }

  const now = new Date();
  monthlyNet.forEach((net, i) => {
    const vat = monthlyVat[i];
    const val = monthlyTotals[i];
    const x = pl + i * slot + (slot - bW) / 2;
    const isCurrent = reportYear === now.getFullYear() && i === now.getMonth();

    const bH = val > 0 ? Math.max((val / axisTop) * cH, 3) : 3;
    const netH = val > 0 && showVatMonthly ? (net / axisTop) * cH : bH;
    const vatH = val > 0 && showVatMonthly ? Math.max(bH - netH, 0) : 0;
    const y = pt + cH - bH;

    ctx.fillStyle = val > 0 ? (isCurrent ? '#1565C0' : '#1976D2') : (dark ? 'rgba(255,255,255,0.2)' : '#e8e8e8');
    ctx.fillRect(x, y + vatH, bW, netH);

    if (showVatMonthly && vatH > 0) {
      ctx.fillStyle = isCurrent ? '#4a9d82' : '#6ab89c';
      ctx.fillRect(x, y, bW, vatH);
    }

    // Month name below the x-axis; that month's sum sits above its own bar
    // instead (rotated sideways when it wouldn't otherwise fit its slot).
    // When ALV is shown, the vat portion is drawn in green rather than
    // being appended inline with the price.
    ctx.fillStyle = isCurrent ? '#1565C0' : '#505050';
    ctx.font = isCurrent ? 'bold 11px -apple-system, sans-serif' : '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(months()[i], x + bW / 2, H - pb + 4);
    if (val > 0) {
      ctx.save();
      ctx.fillStyle = dark ? '#c8ccd2' : '#707070';
      ctx.font = rotateValLabel ? rotatedValFont : valFont;
      if (rotateValLabel) {
        // Rotated (reads bottom-to-top), anchored just above this bar's own
        // top and growing further upward from there — a vertical label is
        // only ~9px wide instead of the full string width, so it no longer
        // overlaps the neighbouring month's label. Smaller font than the
        // normal case since narrow screens (where this branch fires) have
        // the least headroom to spare. Price and vat are drawn as two
        // separate segments end-to-end along that same rotated line (vat
        // second, in green) instead of one combined string, matching the
        // non-rotated layout below.
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.translate(x + bW / 2, y - 4);
        ctx.rotate(-Math.PI / 2);
        const priceText = chartValLabel(val);
        ctx.fillText(priceText, 0, 0);
        if (showVatMonthly && vat > 0) {
          const priceWidth = ctx.measureText(priceText).width;
          ctx.fillStyle = isCurrent ? '#4a9d82' : '#6ab89c';
          ctx.fillText(`(${chartValLabel(vat)})`, priceWidth + 6, 0);
        }
      } else {
        // Above the bar's own top instead of below the axis — price closest
        // to the bar, vat (when shown) in green just above that.
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(chartValLabel(val), x + bW / 2, y - 4);
        if (showVatMonthly && vat > 0) {
          ctx.fillStyle = isCurrent ? '#4a9d82' : '#6ab89c';
          ctx.fillText(`(${chartValLabel(vat)})`, x + bW / 2, y - 4 - 13);
        }
      }
      ctx.restore();
    }
  });
}

function drawBarsHorizontal(W, monthlyNet, monthlyVat, monthlyTotals, axisTop, step, numSteps, dark) {
  const rowH = 28, pt = 20, pb = 4;
  const H = pt + 12 * rowH + pb;
  const { ctx } = sizeCanvas('chart-bars', W, H);

  ctx.font = '11px -apple-system, sans-serif';
  const monthLabelWidth = Math.max(...months().map(m => ctx.measureText(m).width));
  const pl = Math.ceil(monthLabelWidth) + 12, pr = 8;
  const cW = W - pl - pr;

  // Money axis gridlines + labels along the top, reading left-to-right.
  for (let i = 0; i <= numSteps; i++) {
    const val = i * step;
    const x = pl + (val / axisTop) * cW;
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, pt); ctx.lineTo(x, H - pb); ctx.stroke();
    ctx.fillStyle = dark ? '#f2f2f2' : '#070707';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(chartAxisLabel(val), x, pt - 4);
  }

  const now = new Date();
  monthlyNet.forEach((net, i) => {
    const vat = monthlyVat[i];
    const val = monthlyTotals[i];
    const isCurrent = reportYear === now.getFullYear() && i === now.getMonth();
    const rowY = pt + i * rowH;
    const barH = Math.max(rowH * 0.55, 4);
    const barY = rowY + (rowH - barH) / 2;

    const bW = val > 0 ? Math.max((val / axisTop) * cW, 3) : 3;
    const netW = val > 0 && showVatMonthly ? (net / axisTop) * cW : bW;
    const vatW = val > 0 && showVatMonthly ? Math.max(bW - netW, 0) : 0;

    ctx.fillStyle = val > 0 ? (isCurrent ? '#1565C0' : '#1976D2') : (dark ? 'rgba(255,255,255,0.2)' : '#e8e8e8');
    ctx.fillRect(pl, barY, netW, barH);

    if (showVatMonthly && vatW > 0) {
      ctx.fillStyle = isCurrent ? '#4a9d82' : '#6ab89c';
      ctx.fillRect(pl + netW, barY, vatW, barH);
    }

    // Month name, left of the axis, right-aligned against it.
    ctx.fillStyle = isCurrent ? '#1565C0' : '#505050';
    ctx.font = isCurrent ? 'bold 11px -apple-system, sans-serif' : '11px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(months()[i], pl - 6, rowY + rowH / 2);

    if (val > 0) {
      // Net, or gross with the vat portion in parentheses (see
      // barValueLabel) — after the bar's end, reading normally left-to-right
      // since a whole row's width is available instead of a single bar's
      // worth. Falls back to inside the bar (right-aligned, light text)
      // only if the bar itself reaches too close to the canvas edge to
      // leave room, e.g. the year's peak month.
      const label = barValueLabel(val, vat);
      ctx.font = '11px -apple-system, sans-serif';
      const labelWidth = ctx.measureText(label).width;
      const barEndX = pl + bW;
      const fitsOutside = barEndX + 6 + labelWidth <= W - pr;
      ctx.textBaseline = 'middle';
      if (fitsOutside) {
        ctx.textAlign = 'left';
        ctx.fillStyle = dark ? '#c8ccd2' : '#707070';
        ctx.fillText(label, barEndX + 6, rowY + rowH / 2);
      } else {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.fillText(label, barEndX - 6, rowY + rowH / 2);
      }
    }
  });
}

// ── RAPORTTIEN LATAUS ──

// ── PDF (jsPDF + autoTable, self-hosted in js/vendor/ — see app/index.html) ──
// Reports save a real PDF file straight to disk; no print dialog, no extra
// browser tab. Table styling mirrors the app's mint/navy palette.
const PDF_HEAD_COLOR = [74, 157, 130];
const PDF_MARGIN = 14;

function pdfHeader(doc, title) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, PDF_MARGIN, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`${t('createdOn')} ${fmtDate(new Date())}`, PDF_MARGIN, 25);

  if (state.cfg.company) {
    doc.setTextColor(20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(state.cfg.company, 196, 15, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120);
    let ly = 20;
    if (state.cfg.ytunnus) { doc.text(`Y-tunnus: ${state.cfg.ytunnus}`, 196, ly, { align: 'right' }); ly += 5; }
    if (state.cfg.email) doc.text(state.cfg.email, 196, ly, { align: 'right' });
  }
  doc.setTextColor(0);
  return 34; // y position content starts from
}

function pdfTable(doc, y, head, body) {
  doc.autoTable({
    startY: y,
    head: [head],
    body,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: PDF_HEAD_COLOR, textColor: 255 },
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
  });
  return doc.lastAutoTable.finalY + 10;
}

// ── Browser-tab preview (the big "Vuosiraportti"/"Kuukausiraportti" buttons
// open this — an HTML page the user can read, print, or manually save as
// PDF, as opposed to the direct-download PDF from the "Lataa PDF" button) ──
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

function openReport(html) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) win.addEventListener('load', () => URL.revokeObjectURL(url));
  else URL.revokeObjectURL(url);
}

function nonce() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

// Shared by the PDF and CSV exports, so both always describe exactly the
// same set of invoices/entries/expenses for a given year.
function getYearReportData(year) {
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

  const openEntries = allEntries.filter(e => !e.invoiced);

  return {
    year, invs, allEntries, allExpenses, monthlyData, totalInvoiced, totalSecs,
    openSecs, totalExpenses, paidTotal, unpaidTotal, custMap, openEntries,
  };
}

function downloadYearReport() {
  const {
    year, invs, allExpenses, monthlyData, totalInvoiced, totalSecs,
    totalExpenses, custMap, openEntries,
  } = getYearReportData(reportYear);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = pdfHeader(doc, `${t('yearReport')} ${year}`);

  doc.setFontSize(10);
  doc.setTextColor(40);
  const summaryText = `${t('invoicedLabel')}: ${fmtEur(totalInvoiced)}  ·  ${t('hours')}: ${fmtShort(totalSecs)} h` +
    (totalExpenses > 0 ? `  ·  ${t('expenses')}: ${fmtEur(totalExpenses)}` : '');
  doc.text(summaryText, PDF_MARGIN, y);
  doc.setTextColor(0);
  y += 8;

  const monthRows = monthlyData
    .map((d, i) => (d.invoiced > 0 || d.secs > 0)
      ? [monthNames()[i], d.count || '—', d.secs > 0 ? fmtShort(d.secs) + ' h' : '—', d.invoiced > 0 ? fmtEur(d.invoiced) : '—']
      : null)
    .filter(Boolean);
  monthRows.push([`${t('totalRow')} ${year}`, invs.length, fmtShort(totalSecs) + ' h', fmtEur(totalInvoiced)]);
  y = pdfTable(doc, y, [t('date'), t('invoiceSuffix'), t('hours'), t('invoicedLabel')], monthRows);

  if (Object.keys(custMap).length) {
    const custRows = Object.entries(custMap).sort((a, b) => b[1].total - a[1].total)
      .map(([name, v]) => [name, v.count, fmtShort(v.secs) + ' h', fmtEur(v.total)]);
    y = pdfTable(doc, y, [t('customer'), t('invoiceSuffix'), t('hours'), t('invoicedLabel')], custRows);
  }

  if (invs.length) {
    const invRows = invs.map(inv => {
      const custs = [...new Set(inv.entries.map(e => e.customer).filter(Boolean))];
      return [t('invoicePrefix') + String(inv.id).padStart(3, '0'), fmtDate(inv.date), custs.join(', ') || '—',
        fmtShort(inv.totalSecs) + ' h', fmtEur(inv.total), fmtEur(inv.vatAmount ?? 0), inv.paid ? t('paid') : t('unpaid')];
    });
    y = pdfTable(doc, y, [t('numberLabel'), t('date'), t('customer'), t('hours'), t('amount'), t('vatLabel'), t('statusLabel')], invRows);
  }

  if (openEntries.length) {
    const openRows = openEntries.map(e => [fmtDate(e.date), customerName(e.customerId) || '—', fmtHours(e.secs),
      fmtEur((e.secs / 3600) * (e.rate ?? state.cfg.hourly)), e.service || '—', e.notes || '']);
    y = pdfTable(doc, y, [t('date'), t('customer'), t('hours'), t('valueLabel'), t('service'), t('notes')], openRows);
  }

  if (allExpenses.length) {
    const expRows = allExpenses.map(e => [fmtDate(e.date), e.description, customerName(e.customerId) || '—',
      fmtEur(e.amount), e.vat != null ? fmtEur(e.vatAmount ?? (e.amount * e.vat / 100)) : '—', e.invoiced ? t('invoicedLabel') : t('open')]);
    y = pdfTable(doc, y, [t('date'), t('description'), t('customer'), t('amount'), t('vatLabel'), t('statusLabel')], expRows);
  }

  doc.save(`${t('yearReport')} ${year}.pdf`);
}

// Opens the same report as a browser tab instead of downloading a PDF —
// wired to the big "Vuosiraportti" button.
function viewYearReport() {
  const {
    year, invs, allExpenses, monthlyData, totalInvoiced, totalSecs,
    openSecs, totalExpenses, paidTotal, unpaidTotal, custMap, openEntries,
  } = getYearReportData(reportYear);

  const nc = nonce();

  const monthRows = monthlyData.map((d, i) => (d.invoiced > 0 || d.secs > 0) ? `
    <tr>
      <td>${monthNames()[i]}</td>
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
      <td>${t('invoicePrefix')}${String(inv.id).padStart(3, '0')}</td>
      <td>${fmtDate(inv.date)}</td>
      <td>${custs.map(esc).join(', ') || '—'}</td>
      <td class="num">${fmtShort(inv.totalSecs)} h</td>
      <td class="num">${fmtEur(inv.total)}</td>
      <td class="num">${fmtEur(inv.vatAmount ?? 0)}</td>
      <td><span class="tag ${inv.paid ? 'tag-paid' : 'tag-unpaid'}">${inv.paid ? t('paid') : t('unpaid')}</span></td>
    </tr>`;
  }).join('');

  const openRows = openEntries.map(e => `
    <tr>
      <td>${fmtDate(e.date)}</td>
      <td>${esc(customerName(e.customerId) || '—')}</td>
      <td class="num">${fmtHours(e.secs)}</td>
      <td class="num">${fmtEur((e.secs / 3600) * (e.rate ?? state.cfg.hourly))}</td>
      <td style="font-size:12px;color:#666;">${esc(e.service || '')}</td>
      <td style="font-size:12px;color:#666;">${esc(e.notes || '')}</td>
    </tr>`).join('');

  const expRows = allExpenses.map(e => `
    <tr>
      <td>${fmtDate(e.date)}</td>
      <td>${esc(e.description)}</td>
      <td>${esc(customerName(e.customerId) || '—')}</td>
      <td class="num">${fmtEur(e.amount)}</td>
      <td class="num">${e.vat != null ? fmtEur(e.vatAmount ?? (e.amount * e.vat / 100)) : '—'}</td>
      <td><span class="tag ${e.invoiced ? 'tag-inv' : 'tag-open'}">${e.invoiced ? t('invoicedLabel') : t('open')}</span></td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="${state.lang}"><head><meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nc}'; script-src 'nonce-${nc}';">
    <title>${t('yearReport')} ${year}</title>
    ${reportStyles(nc)}
  </head><body>
    <div class="rep-header">
      <div>
        <h1>${t('yearReport')} ${year}</h1>
        <div class="meta">${t('createdOn')} ${fmtDate(new Date())}</div>
      </div>
      ${companyHeader()}
    </div>

    <div class="summary">
      <div class="sum-item">
        <div class="sum-label">${t('invoicedLabel')}</div>
        <div class="sum-val">${fmtEur(totalInvoiced)}</div>
        <div class="sum-sub">${invs.length} ${t('invoiceSuffix')} · ${t('paid').toLowerCase()} ${fmtEur(paidTotal)}</div>
      </div>
      <div class="sum-item">
        <div class="sum-label">${t('hours')}</div>
        <div class="sum-val">${fmtShort(totalSecs)} h</div>
        ${openSecs > 0 ? `<div class="sum-sub">${t('uninvoiced')}: ${fmtShort(openSecs)} h</div>` : `<div class="sum-sub">${t('allInvoiced')}</div>`}
      </div>
      ${unpaidTotal > 0 ? `<div class="sum-item">
        <div class="sum-label">${t('unpaid')}</div>
        <div class="sum-val" style="color:#c62828;">${fmtEur(unpaidTotal)}</div>
        <div class="sum-sub">${invs.filter(i => !i.paid).length} ${t('invoiceSuffix')}</div>
      </div>` : ''}
      ${totalExpenses > 0 ? `<div class="sum-item">
        <div class="sum-label">${t('expenses')}</div>
        <div class="sum-val">${fmtEur(totalExpenses)}</div>
        <div class="sum-sub">${allExpenses.length} ${t('receipts')}</div>
      </div>` : ''}
    </div>

    <h2>${t('monthlyBreakdown')}</h2>
    <table>
      <thead><tr><th>${t('date')}</th><th class="num">${t('invoiceSuffix')}</th><th class="num">${t('hours')}</th><th class="num">${t('invoicedLabel')}</th></tr></thead>
      <tbody>
        ${monthRows || `<tr><td colspan="4" style="color:#aaa;padding:10px 8px;">${t('noActivity')}</td></tr>`}
        <tr class="total-row"><td>${t('totalRow')} ${year}</td><td class="num">${invs.length}</td><td class="num">${fmtShort(totalSecs)} h</td><td class="num">${fmtEur(totalInvoiced)}</td></tr>
      </tbody>
    </table>

    ${Object.keys(custMap).length > 0 ? `
    <h2>${t('customerSummary')}</h2>
    <table>
      <thead><tr><th>${t('customer')}</th><th class="num">${t('invoiceSuffix')}</th><th class="num">${t('hours')}</th><th class="num">${t('invoicedLabel')}</th></tr></thead>
      <tbody>${custRows}</tbody>
    </table>` : ''}

    ${invs.length > 0 ? `
    <h2>${t('invoice')}</h2>
    <table>
      <thead><tr><th>${t('numberLabel')}</th><th>${t('date')}</th><th>${t('customer')}</th><th class="num">${t('hours')}</th><th class="num">${t('amount')}</th><th class="num">${t('vatLabel')}</th><th>${t('statusLabel')}</th></tr></thead>
      <tbody>${invRows}</tbody>
    </table>` : ''}

    ${openEntries.length > 0 ? `
    <h2>${t('uninvoicedEntries')}</h2>
    <table>
      <thead><tr><th>${t('date')}</th><th>${t('customer')}</th><th class="num">${t('hours')}</th><th class="num">${t('valueLabel')}</th><th>${t('service')}</th><th>${t('notes')}</th></tr></thead>
      <tbody>${openRows}</tbody>
    </table>` : ''}

    ${allExpenses.length > 0 ? `
    <h2>${t('expenses')}</h2>
    <table>
      <thead><tr><th>${t('date')}</th><th>${t('description')}</th><th>${t('customer')}</th><th class="num">${t('amount')}</th><th class="num">${t('vatLabel')}</th><th>${t('statusLabel')}</th></tr></thead>
      <tbody>${expRows}</tbody>
    </table>` : ''}

    <button class="print-btn" id="pbtn">${t('printSavePdf')}</button>
    <script nonce="${nc}">document.getElementById('pbtn').addEventListener('click',()=>window.print())</script>
  </body></html>`;

  openReport(html);
}

// Shared by the PDF and CSV exports, same reasoning as getYearReportData above.
function getMonthReportData(year, month) {
  const monthName = monthNames()[month];

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

  return { year, month, monthName, invs, allEntries, allExpenses, totalSecs, totalVal, totalInvoiced, totalExpenses, openSecs };
}

function downloadMonthReport() {
  const sel = document.getElementById('rep-month-sel');
  const {
    year, monthName, invs, allEntries, allExpenses, totalSecs, totalVal,
    totalInvoiced, totalExpenses, openSecs,
  } = getMonthReportData(reportYear, parseInt(sel.value));

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = pdfHeader(doc, `${monthName} ${year}`);

  doc.setFontSize(10);
  doc.setTextColor(40);
  const summaryText = `${t('hours')}: ${fmtShort(totalSecs)} h  ·  ${t('invoicedLabel')}: ${fmtEur(totalInvoiced)}` +
    (openSecs > 0 ? `  ·  ${t('uninvoiced')}: ${fmtShort(openSecs)} h` : '') +
    (totalExpenses > 0 ? `  ·  ${t('expenses')}: ${fmtEur(totalExpenses)}` : '');
  doc.text(summaryText, PDF_MARGIN, y);
  doc.setTextColor(0);
  y += 8;

  if (!allEntries.length) {
    doc.setTextColor(150);
    doc.text(`${t('noEntriesMonth')} ${monthName} ${year}.`, PDF_MARGIN, y);
    doc.setTextColor(0);
    y += 8;
  }

  if (invs.length) {
    const invRows = invs.map(inv => {
      const custs = [...new Set(inv.entries.map(e => e.customer).filter(Boolean))];
      return [t('invoicePrefix') + String(inv.id).padStart(3, '0'), fmtDate(inv.date), custs.join(', ') || '—',
        fmtEur(inv.total), fmtEur(inv.vatAmount ?? 0), inv.paid ? t('paid') : t('unpaid')];
    });
    y = pdfTable(doc, y, [t('numberLabel'), t('date'), t('customer'), t('amount'), t('vatLabel'), t('statusLabel')], invRows);
  }

  if (allExpenses.length) {
    const expRows = allExpenses.map(e => [fmtDate(e.date), e.description, customerName(e.customerId) || '—',
      fmtEur(e.amount), e.vat != null ? fmtEur(e.vatAmount ?? (e.amount * e.vat / 100)) : '—', e.invoiced ? t('invoicedLabel') : t('open')]);
    y = pdfTable(doc, y, [t('date'), t('description'), t('customer'), t('amount'), t('vatLabel'), t('statusLabel')], expRows);
  }

  doc.save(`${monthName} ${year}.pdf`);
}

// ── CSV-VIENTI ──
// Semicolon-delimited (Finnish Excel treats comma as the decimal separator,
// so a comma-delimited CSV misreads every numeric column), UTF-8 BOM so
// Excel picks up ä/ö/å correctly instead of guessing Latin-1.

function csvEscape(v) {
  const s = String(v ?? '');
  return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function csvRow(fields) { return fields.map(csvEscape).join(';'); }
function csvNum(n) { return n.toFixed(2).replace('.', ','); }
function csvHours(secs) { return (secs / 3600).toFixed(2).replace('.', ','); }
function csvSection(title, headers, rows) {
  return [title, csvRow(headers), ...rows.map(csvRow)].join('\r\n');
}

function downloadCsv(filename, sections) {
  const content = '﻿' + sections.filter(Boolean).join('\r\n\r\n') + '\r\n';
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function downloadYearReportCsv() {
  const { year, invs, monthlyData, custMap, openEntries, allExpenses } = getYearReportData(reportYear);

  const monthlySection = csvSection(t('monthlyBreakdown'),
    [t('date'), t('invoiceSuffix'), t('hours'), t('invoicedLabel')],
    monthlyData.map((d, i) => [monthNames()[i], d.count, csvHours(d.secs), csvNum(d.invoiced)]));

  const custSection = Object.keys(custMap).length ? csvSection(t('customerSummary'),
    [t('customer'), t('invoiceSuffix'), t('hours'), t('invoicedLabel')],
    Object.entries(custMap).sort((a, b) => b[1].total - a[1].total)
      .map(([name, v]) => [name, v.count, csvHours(v.secs), csvNum(v.total)])) : '';

  const invSection = invs.length ? csvSection(t('invoice'),
    [t('numberLabel'), t('date'), t('customer'), t('hours'), t('amount'), t('vatLabel'), t('statusLabel')],
    invs.map(inv => [
      `${t('invoicePrefix')}${String(inv.id).padStart(3, '0')}`, fmtDate(inv.date),
      [...new Set(inv.entries.map(e => e.customer).filter(Boolean))].join(', '),
      csvHours(inv.totalSecs), csvNum(inv.total), csvNum(inv.vatAmount ?? 0), inv.paid ? t('paid') : t('unpaid'),
    ])) : '';

  const openSection = openEntries.length ? csvSection(t('uninvoicedEntries'),
    [t('date'), t('customer'), t('hours'), t('valueLabel'), t('service'), t('notes')],
    openEntries.map(e => [
      fmtDate(e.date), customerName(e.customerId) || '—', csvHours(e.secs),
      csvNum((e.secs / 3600) * (e.rate ?? state.cfg.hourly)), e.service || '', e.notes || '',
    ])) : '';

  const expSection = allExpenses.length ? csvSection(t('expenses'),
    [t('date'), t('description'), t('customer'), t('amount'), t('vatLabel'), t('statusLabel')],
    allExpenses.map(e => [
      fmtDate(e.date), e.description, customerName(e.customerId) || '—',
      csvNum(e.amount), e.vat != null ? csvNum(e.vatAmount ?? (e.amount * e.vat / 100)) : '',
      e.invoiced ? t('invoicedLabel') : t('open'),
    ])) : '';

  downloadCsv(`${t('yearReport')}-${year}.csv`, [monthlySection, custSection, invSection, openSection, expSection]);
}

function downloadMonthReportCsv() {
  const sel = document.getElementById('rep-month-sel');
  const { year, monthName, invs, allEntries, allExpenses } = getMonthReportData(reportYear, parseInt(sel.value));

  const entrySection = allEntries.length ? csvSection(t('kirjanpito'),
    [t('date'), t('customer'), t('hours'), t('rateLabel'), t('amount'), t('statusLabel'), t('service'), t('notes')],
    allEntries.map(e => [
      fmtDate(e.date), customerName(e.customerId) || '—', csvHours(e.secs),
      csvNum(e.rate ?? state.cfg.hourly), csvNum((e.secs / 3600) * (e.rate ?? state.cfg.hourly)),
      e.invoiced ? t('invoicedLabel') : t('open'), e.service || '', e.notes || '',
    ])) : '';

  const invSection = invs.length ? csvSection(t('invoice'),
    [t('numberLabel'), t('date'), t('customer'), t('amount'), t('vatLabel'), t('statusLabel')],
    invs.map(inv => [
      `${t('invoicePrefix')}${String(inv.id).padStart(3, '0')}`, fmtDate(inv.date),
      [...new Set(inv.entries.map(e => e.customer).filter(Boolean))].join(', '),
      csvNum(inv.total), csvNum(inv.vatAmount ?? 0), inv.paid ? t('paid') : t('unpaid'),
    ])) : '';

  const expSection = allExpenses.length ? csvSection(t('expenses'),
    [t('date'), t('description'), t('customer'), t('amount'), t('vatLabel'), t('statusLabel')],
    allExpenses.map(e => [
      fmtDate(e.date), e.description, customerName(e.customerId) || '—',
      csvNum(e.amount), e.vat != null ? csvNum(e.vatAmount ?? (e.amount * e.vat / 100)) : '',
      e.invoiced ? t('invoicedLabel') : t('open'),
    ])) : '';

  downloadCsv(`${monthName}-${year}.csv`, [entrySection, invSection, expSection]);
}

// ── Kirjanpitäjän CSV ──
// Deliberately a single flat table (header row + one row per invoice, no
// title line or other sections) — unlike the multi-section reports above,
// this is meant to be imported as-is into accounting software (Netvisor,
// Merit Aktiva, Fennoa etc.), which expects one clean table, not several
// concatenated ones.
function downloadAccountantCsv(filename, invs) {
  const headers = [t('date'), t('numberLabel'), t('customer'), t('vatExcl'), t('vatRateHeader'), t('vatAmountHeader'), t('totalRow')];
  const rows = invs.map(inv => [
    fmtDate(inv.date),
    `${t('invoicePrefix')}${String(inv.id).padStart(3, '0')}`,
    [...new Set(inv.entries.map(e => e.customer).filter(Boolean))].join(', '),
    csvNum(inv.subtotal ?? 0),
    csvNum(inv.vat ?? 0),
    csvNum(inv.vatAmount ?? 0),
    csvNum(inv.total),
  ]);
  downloadCsv(filename, [[csvRow(headers), ...rows.map(csvRow)].join('\r\n')]);
}

function downloadMonthAccountantCsv() {
  const sel = document.getElementById('rep-month-sel');
  const { year, monthName, invs } = getMonthReportData(reportYear, parseInt(sel.value));
  downloadAccountantCsv(`${monthName}-${year}-kirjanpitajalle.csv`, invs);
}

function downloadYearAccountantCsv() {
  const { year, invs } = getYearReportData(reportYear);
  downloadAccountantCsv(`${t('yearReport')}-${year}-kirjanpitajalle.csv`, invs);
}

window.setReportYear = setReportYear;
window.toggleReportVat = toggleReportVat;
window.toggleChartOrientation = toggleChartOrientation;
window.downloadYearReport = downloadYearReport;
window.viewYearReport = viewYearReport;
window.downloadMonthReport = downloadMonthReport;
window.downloadYearReportCsv = downloadYearReportCsv;
window.downloadMonthReportCsv = downloadMonthReportCsv;
window.downloadYearAccountantCsv = downloadYearAccountantCsv;
window.downloadMonthAccountantCsv = downloadMonthAccountantCsv;

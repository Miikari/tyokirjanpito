function pad(n) { return String(n).padStart(2, '0'); }

function fmtDur(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return pad(h) + ':' + pad(m) + ':' + pad(sec);
}

function fmtShort(s) { return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor((s % 3600) / 60)); }

function fmtDate(d) { return new Date(d).toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit', year: 'numeric' }); }

function fmtEur(n) { return n.toFixed(2).replace('.', ',') + ' €'; }

function fmtHours(secs) { return (secs / 3600).toFixed(2).replace('.', ',') + ' h'; }

function esc(s) { return s.replace(/'/g, "\\'"); }

function calcViitenumero(invoiceId) {
  const base = String(invoiceId).padStart(4, '0');
  const digits = base.split('').reverse();
  const weights = [7, 3, 1];
  let sum = 0;
  digits.forEach((d, i) => { sum += parseInt(d) * weights[i % 3]; });
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}

function calcErapaiva(invoiceDateStr, maksuehto) {
  if (maksuehto === 'sopimus') return 'Erillisen sopimuksen mukaan';
  const d = new Date(invoiceDateStr);
  d.setDate(d.getDate() + (parseInt(maksuehto) || 10));
  return d.toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

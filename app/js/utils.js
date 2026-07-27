function pad(n) { return String(n).padStart(2, '0'); }

export function fmtDur(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return pad(h) + ':' + pad(m) + ':' + pad(sec);
}

export function fmtShort(s) { return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor((s % 3600) / 60)); }

export function fmtDate(d) { return new Date(d).toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit', year: 'numeric' }); }

export function fmtEur(n) { return n.toFixed(2).replace('.', ',') + ' €'; }

export function fmtHours(secs) { return (secs / 3600).toFixed(2).replace('.', ',') + ' h'; }

export function roundDuration(rawSecs, cfg) {
  const interval = (cfg.rounding || 15) * 60;
  let total = cfg.rounding === 1 ? rawSecs : Math.ceil(rawSecs / interval) * interval;
  if (cfg.minRounding) total = Math.max(total, cfg.minRounding * 60);
  return total;
}

const BUSINESS_PREFIXES = ['tmi', 'toiminimi', 'oy', 'ab'];

export function avatarInitial(name) {
  const words = String(name || '').trim().split(/\s+/);
  const first = (words[0] || '').toLowerCase().replace(/[:.]/g, '');
  if (words.length > 1 && BUSINESS_PREFIXES.includes(first)) return words[1].charAt(0);
  return words[0] ? words[0].charAt(0) : '';
}

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function calcViitenumero(invoiceId) {
  const base = String(invoiceId).padStart(4, '0');
  const digits = base.split('').reverse();
  const weights = [7, 3, 1];
  let sum = 0;
  digits.forEach((d, i) => { sum += parseInt(d) * weights[i % 3]; });
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}

export function calcErapaiva(invoiceDateStr, maksuehto) {
  if (maksuehto === 'sopimus') return 'Erillisen sopimuksen mukaan';
  const d = new Date(invoiceDateStr);
  d.setDate(d.getDate() + (parseInt(maksuehto) || 10));
  return d.toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── VALIDOINNIT (omat yritystiedot) ──

export function isValidCompanyName(s) {
  return /^[\p{L}\p{N}\s&.,'-]{2,100}$/u.test(s);
}

export function isValidAddress(s) {
  return /^[\p{L}\p{N}\s.,'-]{4,150}$/u.test(s);
}

export function isValidPhone(s) {
  return /^\+?[0-9\s-]{6,20}$/.test(s);
}

export function isValidEmailField(s) {
  return s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

export function isValidYtunnus(s) {
  return /^\d{7}-\d$/.test(s);
}

export function isValidIbanFormat(s) {
  return /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(s.replace(/\s+/g, '').toUpperCase());
}

function ibanChecksumValid(s) {
  const iban = s.replace(/\s+/g, '').toUpperCase();
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, ch => (ch.charCodeAt(0) - 55).toString());
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    remainder = parseInt(String(remainder) + numeric.substring(i, i + 7), 10) % 97;
  }
  return remainder === 1;
}

export function isValidIban(s) {
  return isValidIbanFormat(s) && ibanChecksumValid(s);
}

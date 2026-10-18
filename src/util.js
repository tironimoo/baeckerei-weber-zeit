export const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export const $ = (s, r) => (r || document).querySelector(s);
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pad = (n) => String(n).padStart(2, '0');
export const uid = () => Math.random().toString(36).slice(2, 10);
export const dkey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const mkey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1);
export const pd = (k) => new Date(k + 'T00:00:00');
export const sod = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const wstart = (d) => { const x = sod(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const n = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - n);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y) / 864e5 + 1) / 7);
}
export const fmtT = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());
export const fmtD = (d) => pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.';
export const fmtDY = (d) => fmtD(d) + d.getFullYear();
export const fmtDay = (d) => DAYS[(d.getDay() + 6) % 7] + '., ' + fmtD(d);
export const hm = (min) => { min = Math.max(0, Math.round(min)); return Math.floor(min / 60) + ':' + pad(min % 60); };
export const eur = (n) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
export const dec = (n) => String(n).replace('.', ',');
export const initials = (n) => (n || '?').split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
export const greet = () => { const h = new Date().getHours(); return h < 11 ? 'Guten Morgen' : h < 17 ? 'Guten Tag' : 'Guten Abend'; };
export const weeksBetween = (a, b) => Math.round(((pd(b) - pd(a)) / 864e5 + 1) / 7 * 10) / 10;

/** Tag-Nummer normalisieren (nur Hex, groß) und als SHA-256 ablegen. Die Nummer selbst wird nie gespeichert. */
export async function tagHash(rawUid) {
  const norm = String(rawUid).toUpperCase().replace(/[^0-9A-F]/g, '');
  if (norm.length < 8) throw new Error('Die Tag-Nummer ist zu kurz.');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bwz:' + norm));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const ICONS = {
  nfc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 8.5a6 6 0 0 1 0 7"/><path d="M10 6a10 10 0 0 1 0 12"/><path d="M14 3.5a14 14 0 0 1 0 17"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  logo: '<svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 29V9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><ellipse cx="16" cy="5.5" rx="2.4" ry="4"/><ellipse cx="11.4" cy="12" rx="2.3" ry="4.3" transform="rotate(-38 11.4 12)"/><ellipse cx="20.6" cy="12" rx="2.3" ry="4.3" transform="rotate(38 20.6 12)"/><ellipse cx="11.4" cy="19" rx="2.3" ry="4.3" transform="rotate(-38 11.4 19)"/><ellipse cx="20.6" cy="19" rx="2.3" ry="4.3" transform="rotate(38 20.6 19)"/></svg>',
};

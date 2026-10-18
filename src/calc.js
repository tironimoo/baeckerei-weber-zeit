import { S } from './store.js';
import { dkey, mkey, pd, sod, wstart } from './util.js';

export const ABS = {
  krank: { n: 'Krank', pay: true },
  urlaub: { n: 'Urlaub', pay: true },
  sonst: { n: 'Frei (unbezahlt)', pay: false },
};

export const userById = (id) => S.users.find((u) => u.id === id) || { id, name: '?', role: 'ma' };
export const mas = () => S.users.filter((u) => u.role === 'ma' && u.active);

/* ---------- Arbeitszeit ---------- */
export function netMin(e, now = new Date()) {
  const s = new Date(e.start), en = e.end ? new Date(e.end) : now;
  let brk = e.breakMin || 0;
  if (e.breakStart) brk += (now - new Date(e.breakStart)) / 60000;
  return Math.max(0, (en - s) / 60000 - brk);
}
export const openEntry = (u) => S.entries.find((e) => e.userId === u && !e.end);
export const staleEntry = (u) => { const e = openEntry(u); return e && new Date(e.start) < sod(new Date()) ? e : null; };
export const entriesOf = (u) => S.entries.filter((e) => e.userId === u).sort((a, b) => new Date(b.start) - new Date(a.start));
export const inRange = (e, a, b) => { const s = new Date(e.start); return s >= a && s < b; };
export function dayMins(u, ws) {
  const out = [0, 0, 0, 0, 0, 0, 0], now = new Date();
  S.entries.forEach((e) => {
    if (e.userId !== u) return;
    const d = Math.round((sod(new Date(e.start)) - ws) / 864e5);
    if (d >= 0 && d < 7) out[d] += netMin(e, now);
  });
  return out;
}
export const weekMin = (u, ref) => dayMins(u, wstart(ref)).reduce((a, b) => a + b, 0);
export function todayMin(u, now) {
  const a = sod(now), b = new Date(a); b.setDate(b.getDate() + 1);
  return S.entries.filter((e) => e.userId === u && inRange(e, a, b)).reduce((s, e) => s + netMin(e, now), 0);
}
export const monthEntries = (u, key) => entriesOf(u).filter((e) => mkey(new Date(e.start)) === key);

export function flags(e) {
  const f = [], n = netMin(e);
  if (closureOn(new Date(e.start))) f.push({ c: 'warn', t: 'In den Betriebsferien' });
  if (!e.end) { if (new Date(e.start) < sod(new Date())) f.push({ c: 'bad', t: 'Ende fehlt' }); return f; }
  if (n > 600) f.push({ c: 'bad', t: 'Über 10 Std.' });
  const need = n > 540 ? 45 : n > 360 ? 30 : 0;
  if ((e.breakMin || 0) < need) f.push({ c: 'warn', t: 'Pause fehlt (mind. ' + need + ' Min.)' });
  return f;
}

/* ---------- Betriebsferien, Fehlzeiten, Urlaub ---------- */
export const closureOn = (d) => { const k = dkey(d); return S.closures.find((c) => k >= c.from && k <= c.to); };
export const dailySoll = () => S.settings.weeklyHours * 60 / S.settings.workDays;
export function weekSoll(ws) {
  let open = 0;
  for (let i = 0; i < 6; i++) { const d = new Date(ws); d.setDate(d.getDate() + i); if (!closureOn(d)) open++; }
  return S.settings.weeklyHours * 60 * open / 6;
}
export function absDates(a) {
  const out = [], d = pd(a.from), e = pd(a.to);
  while (d <= e) { if (d.getDay() !== 0 && !closureOn(d)) out.push(dkey(d)); d.setDate(d.getDate() + 1); }
  return out;
}
function paidDays(u, fromK, toK) {
  const seen = {};
  S.absences.forEach((a) => {
    if (a.userId !== u || a.status !== 'ok' || !ABS[a.type].pay) return;
    absDates(a).forEach((k) => { if (k >= fromK && k <= toK) seen[k] = 1; });
  });
  return Object.keys(seen);
}
function creditOf(days) {
  const w = {};
  days.forEach((k) => { const x = dkey(wstart(pd(k))); w[x] = (w[x] || 0) + 1; });
  return Object.keys(w).reduce((s, x) => s + Math.min(weekSoll(pd(x)), w[x] * dailySoll()), 0);
}
export function weekCredit(u, ws) { const e = new Date(ws); e.setDate(e.getDate() + 6); return creditOf(paidDays(u, dkey(ws), dkey(e))); }
export function monthCredit(u, key) { const p = key.split('-'), last = new Date(+p[0], +p[1], 0); return creditOf(paidDays(u, key + '-01', dkey(last))); }
export function monthAbs(u, key) {
  const a = key + '-01', p = key.split('-'), b = dkey(new Date(+p[0], +p[1], 0));
  return S.absences.filter((x) => x.userId === u && x.from <= b && x.to >= a).sort((p2, q) => (q.from < p2.from ? -1 : 1));
}
export const todayAbs = (u) => { const k = dkey(new Date()); return S.absences.find((a) => a.userId === u && a.status === 'ok' && k >= a.from && k <= a.to); };
export const nextClosure = () => { const k = dkey(new Date()); return S.closures.filter((c) => c.to >= k).sort((a, b) => (a.from < b.from ? -1 : 1))[0]; };
export const pendCount = () => S.requests.filter((r) => r.status === 'pending').length + S.absences.filter((a) => a.status === 'pending').length;

function vacDays(keys) {
  const w = {};
  keys.forEach((k) => { const x = dkey(wstart(pd(k))); w[x] = (w[x] || 0) + 1; });
  return Object.keys(w).reduce((s, x) => s + Math.min(S.settings.workDays, w[x]), 0);
}
export function vacationInfo(u, year) {
  const cl = {}, tk = {};
  S.closures.forEach((c) => { const d = pd(c.from), e = pd(c.to); while (d <= e) { if (d.getFullYear() === year && d.getDay() !== 0) cl[dkey(d)] = 1; d.setDate(d.getDate() + 1); } });
  S.absences.forEach((a) => {
    if (a.userId !== u || a.status !== 'ok' || a.type !== 'urlaub') return;
    absDates(a).forEach((k) => { if (pd(k).getFullYear() === year) tk[k] = 1; });
  });
  const ent = S.settings.vacationDays, closure = vacDays(Object.keys(cl)), own = vacDays(Object.keys(tk));
  return { ent, closure, own, rest: ent - closure - own };
}

/** Lesbarer Text für einen Protokolleintrag. */
export function auditText(r) {
  const n = r.newRow || {}, o = r.oldRow || {}, row = r.op === 'DELETE' ? o : n;
  const who = row.user_id ? userById(row.user_id).name : '';
  const t = (iso) => { if (!iso) return ''; const d = new Date(iso); return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '. ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const pad2 = (x) => String(x).padStart(2, '0');
  switch (r.tbl) {
    case 'time_entries':
      if (r.op === 'INSERT') return { a: row.end_at ? 'Zeit eingetragen' : 'Eingestempelt', d: `${who}, ${t(row.start_at)} (${row.source})` };
      if (!o.end_at && n.end_at) return { a: 'Ausgestempelt', d: `${who}, ${t(n.end_at)}, Pause ${n.break_min} Min.` };
      if (!o.break_start && n.break_start) return { a: 'Pause gestartet', d: who };
      if (o.break_start && !n.break_start && o.end_at == null && n.end_at == null) return { a: 'Pause beendet', d: `${who}, Pause gesamt ${n.break_min} Min.` };
      if (o.break_min !== n.break_min && o.start_at === n.start_at && o.end_at === n.end_at) return { a: 'Pause angepasst', d: `${who}: ${o.break_min} auf ${n.break_min} Min.` };
      return { a: 'Zeit geändert', d: `${who}: ${t(o.start_at)}–${t(o.end_at)} auf ${t(n.start_at)}–${t(n.end_at)}${n.note ? ' · ' + n.note : ''}` };
    case 'change_requests':
      if (r.op === 'INSERT') return { a: 'Korrektur beantragt', d: `${who}, ${row.work_date}, ${String(row.start_time).slice(0, 5)}–${String(row.end_time).slice(0, 5)}. ${row.reason}` };
      return { a: n.status === 'ok' ? 'Antrag angenommen' : 'Antrag abgelehnt', d: `${who}, ${row.work_date}` };
    case 'absences': {
      const ty = ABS[row.type] ? ABS[row.type].n : row.type, span = `${row.date_from} bis ${row.date_to}`;
      if (r.op === 'INSERT') return { a: n.status === 'ok' ? 'Fehlzeit eingetragen' : 'Fehlzeit beantragt', d: `${who}: ${ty} ${span}` };
      return { a: n.status === 'ok' ? 'Fehlzeit bestätigt' : (n.why || 'Fehlzeit abgelehnt'), d: `${who}: ${ty} ${span}` };
    }
    case 'nfc_tags':
      if (r.op === 'UNKNOWN') return { a: 'Unbekannter Tag abgewiesen', d: 'Am Tablet aufgelegt' };
      if (r.op === 'BLOCKED') return { a: 'Gesperrter Tag abgewiesen', d: (r.newRow && r.newRow.label) || '' };
      if (r.op === 'INSERT') return { a: 'Tag angelernt', d: `${n.label} für ${who}` };
      if (r.op === 'DELETE') return { a: 'Tag gelöscht', d: o.label };
      if (o.active !== n.active) return { a: n.active ? 'Tag entsperrt' : 'Tag gesperrt', d: n.label };
      return { a: 'Tag geändert', d: n.label };
    case 'settings':
      return { a: 'Einstellungen geändert', d: Object.keys(n).filter((k) => String(n[k]) !== String(o[k])).map((k) => `${k}: ${o[k]} auf ${n[k]}`).join(', ') };
    case 'closures':
      return { a: r.op === 'INSERT' ? 'Betriebsferien eingetragen' : r.op === 'DELETE' ? 'Betriebsferien entfernt' : 'Betriebsferien geändert', d: `${row.label}: ${row.date_from} bis ${row.date_to}` };
    case 'profiles':
      if (r.op === 'INSERT') return { a: 'Konto angelegt', d: row.email || '' };
      return { a: 'Person geändert', d: `${n.full_name}${o.active !== n.active ? (n.active ? ' (aktiviert)' : ' (deaktiviert)') : ''}` };
    default: return { a: r.op, d: r.tbl };
  }
}

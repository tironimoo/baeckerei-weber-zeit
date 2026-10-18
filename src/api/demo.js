// Übungsmodus: gleiche Funktionen wie die echte Anbindung, aber alle Daten bleiben nur in diesem Browser.
// Aufruf mit "?demo" an der Adresse. Hier liegen keine echten Daten.
import { dkey, tagHash, uid, wstart } from '../util.js';

const KEY = 'bwz-demo-v1';
export const DEMO_TAG_UID = '04:A2:19:7C:3B:5E:80';
export const DEMO_UNKNOWN_UID = '04:7F:11:00:AA:42:9C';
export class AppError extends Error {}

const ME = { ma: 'ma1', chef: 'chef' };
let D = null;
let session = null; // { role, uid }
let mfaDone = false;

function seed(hash) {
  const now = new Date(), ws = wstart(now), E = [];
  const P = [[[0, 6, 0, 400, 30], [2, 6, 30, 370, 30], [4, 7, 0, 340, 30]], [[1, 6, 0, 420, 30], [3, 6, 0, 390, 30], [5, 7, 0, 360, 30]], [[0, 6, 0, 400, 30], [2, 6, 0, 410, 30], [4, 6, 30, 380, 0]], [[0, 6, 0, 400, 30], [2, 6, 30, 370, 30], [4, 7, 0, 340, 30]]];
  let n = 0;
  P.forEach((wk, i) => {
    const base = new Date(ws); base.setDate(base.getDate() - 7 * (3 - i));
    wk.forEach((x) => {
      const s = new Date(base); s.setDate(s.getDate() + x[0]); s.setHours(x[1], x[2], 0, 0);
      const en = new Date(s.getTime() + x[3] * 60000); if (en > now) return;
      E.push({ id: uid(), userId: 'ma1', start: s.toISOString(), end: en.toISOString(), breakMin: x[4], breakStart: null, source: (n++ % 2) ? 'Handy' : 'Tablet-NFC', note: '' });
    });
  });
  const rd = new Date(ws); rd.setDate(rd.getDate() - 7 + 3);
  return {
    settings: { business: 'Bäckerei Weber', weeklyHours: 18, workDays: 3, wage: 13.9, vacationDays: 18, idleSec: 60, retentionYears: 2 },
    closures: [{ id: 'c1', label: 'Betriebsferien (Hessische Sommerferien 2027)', from: '2027-06-28', to: '2027-08-08' }],
    users: [
      { id: 'ma1', name: 'Lena Bauer', email: 'lena@demo', role: 'ma', active: true },
      { id: 'chef', name: 'Elisabeth Roßner', email: 'chefin@demo', role: 'chef', active: true },
    ],
    entries: E,
    requests: [{ id: uid(), userId: 'ma1', entryId: null, date: dkey(rd), start: '06:30', end: '11:00', breakMin: 0, reason: 'Vertretung, Lieferung angenommen', status: 'pending', created: new Date().toISOString() }],
    absences: [],
    tags: [{ id: 't1', uidHash: hash, label: 'Schlüsselanhänger blau', userId: 'ma1', active: true, lastUsed: null }],
    audit: [],
  };
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) { /* privater Modus */ } };
const clone = (x) => JSON.parse(JSON.stringify(x));
const actorName = () => (session ? (D.users.find((u) => u.id === session.uid) || {}).name : 'Tablet');
function log(tbl, op, oldRow, newRow) {
  D.audit.unshift({ id: uid(), ts: new Date().toISOString(), actorName: actorName(), tbl, op, rowId: (newRow || oldRow || {}).id, oldRow, newRow });
  D.audit = D.audit.slice(0, 200);
}
const E2R = (e) => e && ({ id: e.id, user_id: e.userId, start_at: e.start, end_at: e.end, break_min: e.breakMin, break_start: e.breakStart, source: e.source, note: e.note });
const A2R = (a) => a && ({ id: a.id, user_id: a.userId, type: a.type, date_from: a.from, date_to: a.to, status: a.status, why: a.why });

function chefOnly() { if (!session || session.role !== 'chef' || !mfaDone) throw new AppError('Nur die Chefin.'); }
function maOnly() { if (!session || session.role !== 'ma') throw new AppError('Nicht erlaubt.'); }

/* Gleiche Regeln wie do_stamp in supabase/schema.sql */
function doStamp(userId, source) {
  const u = D.users.find((x) => x.id === userId && x.role === 'ma' && x.active);
  if (!u) return { status: 'blocked' };
  const first = u.name.split(' ')[0] || 'du', now = new Date();
  let last = 0;
  D.entries.filter((e) => e.userId === userId).forEach((e) => { last = Math.max(last, +new Date(e.start), e.end ? +new Date(e.end) : 0); });
  if (last && now - last < 60000) return { status: 'dup', name: first };
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const e = D.entries.find((x) => x.userId === userId && !x.end);
  if (e) {
    if (new Date(e.start) < today) return { status: 'stale', name: first, entry_id: e.id };
    const old = clone(e);
    if (e.breakStart) { e.breakMin += Math.max(1, Math.round((now - new Date(e.breakStart)) / 60000)); }
    const work = (now - new Date(e.start)) / 60000 - e.breakMin;
    if (source === 'Tablet-NFC' && e.breakMin === 0 && work > 360) e.breakMin = 30;
    e.end = now.toISOString(); e.breakStart = null;
    log('time_entries', 'UPDATE', E2R(old), E2R(e));
    return { status: 'out', entry_id: e.id, name: first, start: e.start, end: e.end, break_min: e.breakMin, net_min: Math.round((now - new Date(e.start)) / 60000 - e.breakMin) };
  }
  const ne = { id: uid(), userId, start: now.toISOString(), end: null, breakMin: 0, breakStart: null, source, note: '' };
  D.entries.push(ne); log('time_entries', 'INSERT', null, E2R(ne));
  return { status: 'in', entry_id: ne.id, name: first, start: ne.start };
}
function doBreak(userId) {
  const e = D.entries.find((x) => x.userId === userId && !x.end);
  if (!e) throw new AppError('Nicht eingestempelt');
  const old = clone(e), now = new Date();
  if (!e.breakStart) { e.breakStart = now.toISOString(); log('time_entries', 'UPDATE', E2R(old), E2R(e)); return { status: 'break_start' }; }
  e.breakMin += Math.max(1, Math.round((now - new Date(e.breakStart)) / 60000)); e.breakStart = null;
  log('time_entries', 'UPDATE', E2R(old), E2R(e));
  return { status: 'break_end', break_min: e.breakMin };
}
function setBreak(entryId, min, filter) {
  if (min < 0 || min > 60) throw new AppError('Ungültige Pause');
  const e = D.entries.find((x) => x.id === entryId && filter(x) && x.end && Date.now() - new Date(x.end) < 15 * 60000);
  if (!e) throw new AppError('Eintrag nicht mehr änderbar');
  const old = clone(e); e.breakMin = min; log('time_entries', 'UPDATE', E2R(old), E2R(e));
}

export const api = {
  mode: 'demo',
  async init() {
    try { D = JSON.parse(localStorage.getItem(KEY)); } catch (e) { D = null; }
    if (!D || !D.users) { D = seed(await tagHash(DEMO_TAG_UID)); save(); }
  },
  async reset() { D = seed(await tagHash(DEMO_TAG_UID)); session = null; mfaDone = false; save(); },
  async restore() { return { state: 'login' }; },
  async signIn(email, password) {
    email = String(email).trim().toLowerCase();
    if (email === 'lena@demo' && password === 'backen') { session = { role: 'ma', uid: ME.ma }; return { state: 'app', session: { role: 'ma', uid: 'ma1', name: 'Lena Bauer', email } }; }
    if (email === 'chefin@demo' && password === 'chefin') { session = { role: 'chef', uid: ME.chef }; mfaDone = false; return { state: 'mfa', factorId: 'demo', session: { role: 'chef', uid: 'chef', name: 'Elisabeth Roßner', email } }; }
    throw new AppError('E-Mail oder Passwort stimmt nicht.');
  },
  async signOut() { session = null; mfaDone = false; },
  async changePassword() {},
  async mfaVerify(factorId, code) { if (String(code).replace(/\s/g, '') !== '123456') throw new AppError('Der Code stimmt nicht oder ist abgelaufen.'); mfaDone = true; },
  async mfaEnroll() { return { factorId: 'demo', qr: '', secret: 'DEMO' }; },

  async loadAll(sess) {
    const chef = sess.role === 'chef';
    const mine = (x) => chef || x.userId === sess.uid;
    return clone({
      settings: D.settings, closures: D.closures, users: chef ? D.users : D.users.filter((u) => u.id === sess.uid),
      entries: D.entries.filter(mine), requests: D.requests.filter(mine), absences: D.absences.filter(mine), tags: chef ? D.tags : [],
    });
  },
  async loadAudit() { chefOnly(); return clone(D.audit); },

  async selfStamp(source) { maOnly(); const r = doStamp(session.uid, source); save(); return r; },
  async selfBreak() { maOnly(); const r = doBreak(session.uid); save(); return r; },
  async selfSetBreak(id, min) { maOnly(); setBreak(id, min, (x) => x.userId === session.uid); save(); },
  async stampFor(userId) { chefOnly(); const r = doStamp(userId, 'Chefin'); save(); return r; },
  async breakFor(userId) { chefOnly(); const r = doBreak(userId); save(); return r; },

  async createRequest(r) { D.requests.push({ id: uid(), userId: r.userId, entryId: r.entryId || null, date: r.date, start: r.start, end: r.end, breakMin: r.breakMin, reason: r.reason, status: 'pending', created: new Date().toISOString() }); save(); },
  async decideRequest(id, ok) {
    chefOnly();
    const r = D.requests.find((x) => x.id === id && x.status === 'pending'); if (!r) throw new AppError('Antrag nicht gefunden');
    if (ok) {
      const s = new Date(r.date + 'T' + r.start), en = new Date(r.date + 'T' + r.end);
      const e = r.entryId && D.entries.find((x) => x.id === r.entryId);
      if (e) { const old = clone(e); e.start = s.toISOString(); e.end = en.toISOString(); e.breakMin = r.breakMin; e.breakStart = null; e.note = 'korrigiert'; log('time_entries', 'UPDATE', E2R(old), E2R(e)); }
      else { const ne = { id: uid(), userId: r.userId, start: s.toISOString(), end: en.toISOString(), breakMin: r.breakMin, breakStart: null, source: 'Nachtrag', note: '' }; D.entries.push(ne); log('time_entries', 'INSERT', null, E2R(ne)); }
    }
    r.status = ok ? 'ok' : 'no'; save();
  },
  async saveEntry(e) {
    chefOnly();
    if (e.id) { const x = D.entries.find((y) => y.id === e.id); const old = clone(x); Object.assign(x, { start: e.start, end: e.end, breakMin: e.breakMin, breakStart: null, note: String(e.note || '').slice(0, 120) }); log('time_entries', 'UPDATE', E2R(old), E2R(x)); }
    else { const ne = { id: uid(), userId: e.userId, start: e.start, end: e.end, breakMin: e.breakMin, breakStart: null, source: 'Nachtrag', note: String(e.note || '').slice(0, 120) }; D.entries.push(ne); log('time_entries', 'INSERT', null, E2R(ne)); }
    save();
  },

  async createAbsence(a) {
    const direct = a.direct && session && session.role === 'chef';
    if (a.direct) chefOnly();
    const n = { id: uid(), userId: a.userId, type: a.type, from: a.from, to: a.to, note: a.note, status: direct ? 'ok' : 'pending', why: '', created: new Date().toISOString() };
    D.absences.push(n); log('absences', 'INSERT', null, A2R(n)); save();
  },
  async setAbsence(id, status, why) { chefOnly(); const a = D.absences.find((x) => x.id === id); const old = clone(a); a.status = status; a.why = why || ''; log('absences', 'UPDATE', A2R(old), A2R(a)); save(); },
  async cancelAbsence(id) {
    const a = D.absences.find((x) => x.id === id); const old = clone(a);
    if (session.role !== 'chef' && !(a.userId === session.uid && a.status === 'pending')) throw new AppError('Dafür fehlt die Berechtigung.');
    a.status = 'no'; a.why = session.role === 'chef' ? 'Storniert' : 'Zurückgezogen'; log('absences', 'UPDATE', A2R(old), A2R(a)); save();
  },

  async saveSetting(key, value) { chefOnly(); D.settings[key] = value; save(); },
  async addClosure(c) { chefOnly(); D.closures.push({ id: uid(), label: c.label, from: c.from, to: c.to }); save(); },
  async delClosure(id) { chefOnly(); D.closures = D.closures.filter((c) => c.id !== id); save(); },
  async saveProfile(id, patch) { chefOnly(); const u = D.users.find((x) => x.id === id); if ('name' in patch) u.name = patch.name; if ('active' in patch) u.active = patch.active; save(); },
  async addTag(t) { chefOnly(); if (D.tags.some((x) => x.uidHash === t.uidHash)) throw new AppError('Das gibt es schon.'); D.tags.push({ id: uid(), uidHash: t.uidHash, label: t.label, userId: t.userId, active: true, lastUsed: null }); save(); },
  async setTagActive(id, active) { chefOnly(); D.tags.find((x) => x.id === id).active = active; save(); },
  async delTag(id) { chefOnly(); D.tags = D.tags.filter((x) => x.id !== id); save(); },

  kiosk: {
    async configured() { return true; },
    async signIn() {},
    async signOut() {},
    async stamp(hash) {
      const t = D.tags.find((x) => x.uidHash === hash);
      if (!t) { log('nfc_tags', 'UNKNOWN', null, { tag: hash.slice(0, 8) }); save(); return { status: 'unknown' }; }
      if (!t.active) { log('nfc_tags', 'BLOCKED', null, { id: t.id, label: t.label }); save(); return { status: 'blocked' }; }
      const r = doStamp(t.userId, 'Tablet-NFC');
      if (r.status === 'in' || r.status === 'out') t.lastUsed = new Date().toISOString();
      save(); return r;
    },
    async setBreak(id, min) { setBreak(id, min, (x) => x.source === 'Tablet-NFC'); save(); },
  },

  /** Nur für Tests: Zeit vorspulen. */
  _debug: { shift(minutes) { D.entries.forEach((e) => { e.start = new Date(+new Date(e.start) - minutes * 60000).toISOString(); if (e.end) e.end = new Date(+new Date(e.end) - minutes * 60000).toISOString(); if (e.breakStart) e.breakStart = new Date(+new Date(e.breakStart) - minutes * 60000).toISOString(); }); save(); } },
};

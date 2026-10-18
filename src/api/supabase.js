import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

const opts = (storageKey) => ({ auth: { storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
// Zwei getrennte Anmeldungen: die Person am Gerät und das Geschäftstablet (Tablet-Konto)
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, opts('bwz-user'));
const kb = createClient(SUPABASE_URL, SUPABASE_KEY, opts('bwz-kiosk'));

export class AppError extends Error {}
/** Nur für automatische Tests. */
export const _clients = { sb, kb };

function friendly(e) {
  const m = String((e && e.message) || e || '');
  if (e instanceof AppError) return e;
  if (/Invalid login credentials/i.test(m)) return new AppError('E-Mail oder Passwort stimmt nicht.');
  if ((e && (e.code === 'PGRST301' || e.code === 'PGRST303')) || /JWT|refresh_token|Auth session missing|not authenticated/i.test(m)) return new AppError('Die Anmeldung ist abgelaufen. Bitte neu anmelden (am Tablet: in den Einstellungen das Gerät neu einrichten).');
  if (/Invalid TOTP|invalid.*code|MFA.*verif/i.test(m)) return new AppError('Der Code stimmt nicht oder ist abgelaufen.');
  if (/Email not confirmed/i.test(m)) return new AppError('Die E-Mail-Adresse ist noch nicht bestätigt.');
  if (/rate limit|too many/i.test(m)) return new AppError('Zu viele Versuche. Bitte kurz warten.');
  if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(m)) return new AppError('Keine Verbindung zum Server. Bitte Internet prüfen.');
  if (e && (e.code === '42501' || /row-level security|permission denied/i.test(m))) return new AppError('Dafür fehlt die Berechtigung. Bitte neu anmelden.');
  if (e && e.code === '23505') return new AppError('Das gibt es schon (zum Beispiel ein offener Eintrag).');
  if (e && e.code === '23514') return new AppError('Die Eingabe passt nicht zu den Regeln (zum Beispiel Zeiten oder Länge).');
  return new AppError(m || 'Das hat nicht geklappt.');
}
async function must(p) {
  let r;
  try { r = await p; } catch (e) { throw friendly(e); }
  if (r.error) throw friendly(r.error);
  return r.data;
}

/** Änderungen, die die Datenbank still ignoriert (keine Berechtigung), melden wir als Fehler. */
async function mustChange(p) {
  const rows = await must(p.select());
  if (!rows || !rows.length) throw new AppError('Das ging nicht: fehlende Berechtigung oder der Eintrag ist weg. Bitte neu anmelden.');
  return rows;
}

const mapUser = (p) => ({ id: p.id, name: p.full_name || '', email: p.email || '', role: p.role, active: p.active });
const mapEntry = (r) => ({ id: r.id, userId: r.user_id, start: r.start_at, end: r.end_at, breakMin: r.break_min, breakStart: r.break_start, source: r.source, note: r.note || '' });
const mapReq = (r) => ({ id: r.id, userId: r.user_id, entryId: r.entry_id, date: r.work_date, start: String(r.start_time).slice(0, 5), end: String(r.end_time).slice(0, 5), breakMin: r.break_min, reason: r.reason, status: r.status, created: r.created_at });
const mapAbs = (r) => ({ id: r.id, userId: r.user_id, type: r.type, from: r.date_from, to: r.date_to, note: r.note || '', status: r.status, why: r.why || '', created: r.created_at });
const mapTag = (r) => ({ id: r.id, uidHash: r.uid_hash, label: r.label, userId: r.user_id, active: r.active, lastUsed: r.last_used });
const mapAudit = (r) => ({ id: r.id, ts: r.ts, actorName: r.actor_name, tbl: r.tbl, op: r.op, rowId: r.row_id, oldRow: r.old_row, newRow: r.new_row });
const mapSettings = (r) => ({ business: r.business, weeklyHours: Number(r.weekly_hours), workDays: r.work_days, wage: Number(r.wage), vacationDays: r.vacation_days, idleSec: r.idle_sec, retentionYears: r.retention_years });
const SETTING_COLS = { business: 'business', weeklyHours: 'weekly_hours', workDays: 'work_days', wage: 'wage', vacationDays: 'vacation_days', idleSec: 'idle_sec', retentionYears: 'retention_years' };

async function afterSignIn(session) {
  const role = await must(sb.rpc('my_role'));
  if (!role) { await sb.auth.signOut(); throw new AppError('Dieses Konto ist noch nicht freigeschaltet. Bitte bei der Chefin melden.'); }
  if (role === 'kiosk') { await sb.auth.signOut(); throw new AppError('Dieses Konto gehört zum Geschäftstablet. Bitte mit dem eigenen Konto anmelden.'); }
  const prof = await must(sb.from('profiles').select('id,full_name,email,role').eq('id', session.user.id).single());
  const sess = { role, uid: session.user.id, name: prof.full_name || '', email: session.user.email || prof.email || '' };
  const aal = await must(sb.auth.mfa.getAuthenticatorAssuranceLevel());
  const f = await must(sb.auth.mfa.listFactors());
  const totp = (f.totp || []).find((x) => x.status === 'verified');
  if (aal.currentLevel === 'aal2') return { state: 'app', session: sess };
  if (totp) return { state: 'mfa', session: sess, factorId: totp.id };
  if (role === 'chef') return { state: 'enroll', session: sess };
  return { state: 'app', session: sess };
}

export const api = {
  mode: 'supabase',
  async init() {},

  /* ----- Anmeldung ----- */
  async restore() {
    try {
      const { data } = await sb.auth.getSession();
      if (!data.session) return { state: 'login' };
      return await afterSignIn(data.session);
    } catch (e) {
      if (e instanceof AppError && !/Verbindung/.test(e.message)) return { state: 'login', error: e.message };
      throw e;
    }
  },
  async signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email: String(email).trim(), password });
    if (error) throw friendly(error);
    return afterSignIn(data.session);
  },
  async signOut() { try { await sb.auth.signOut(); } catch (e) { /* offline: Sitzung läuft von selbst ab */ } },
  async changePassword(pw) { await must(sb.auth.updateUser({ password: pw })); },
  async mfaVerify(factorId, code) {
    const ch = await must(sb.auth.mfa.challenge({ factorId }));
    await must(sb.auth.mfa.verify({ factorId, challengeId: ch.id, code: String(code).replace(/\s/g, '') }));
  },
  async mfaEnroll() {
    const f = await must(sb.auth.mfa.listFactors());
    for (const x of (f.all || []).filter((y) => y.status === 'unverified')) await sb.auth.mfa.unenroll({ factorId: x.id });
    const d = await must(sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator ' + new Date().toISOString().slice(0, 10) }));
    return { factorId: d.id, qr: d.totp.qr_code, secret: d.totp.secret };
  },

  /* ----- Daten lesen ----- */
  async loadAll(sess) {
    const chef = sess.role === 'chef';
    const [st, cl, us, en, rq, ab, tg] = await Promise.all([
      must(sb.from('settings').select('*').eq('id', 1).single()),
      must(sb.from('closures').select('*').order('date_from')),
      must(sb.from('profiles').select('id,email,full_name,role,active')),
      must(sb.from('time_entries').select('*').order('start_at', { ascending: false }).limit(1000)),
      must(sb.from('change_requests').select('*').order('created_at', { ascending: false }).limit(300)),
      must(sb.from('absences').select('*').order('date_from', { ascending: false }).limit(300)),
      chef ? must(sb.from('nfc_tags').select('*').order('created_at')) : Promise.resolve([]),
    ]);
    return {
      settings: mapSettings(st),
      closures: cl.map((c) => ({ id: c.id, label: c.label, from: c.date_from, to: c.date_to })),
      users: us.map(mapUser), entries: en.map(mapEntry), requests: rq.map(mapReq), absences: ab.map(mapAbs), tags: tg.map(mapTag),
    };
  },
  async loadAudit() {
    const r = await must(sb.from('audit_log').select('*').order('ts', { ascending: false }).limit(150));
    return r.map(mapAudit);
  },

  /* ----- Stempeln (immer Serverzeit) ----- */
  selfStamp: (source) => must(sb.rpc('self_stamp', { p_source: source })),
  selfBreak: () => must(sb.rpc('self_break')),
  async selfSetBreak(entryId, min) { await must(sb.rpc('self_set_break', { p_entry: entryId, p_min: min })); },
  stampFor: (userId) => must(sb.rpc('stamp_for', { p_user: userId })),
  breakFor: (userId) => must(sb.rpc('break_for', { p_user: userId })),

  /* ----- Zeiten ----- */
  async createRequest(r) {
    await must(sb.from('change_requests').insert({ user_id: r.userId, entry_id: r.entryId || null, work_date: r.date, start_time: r.start, end_time: r.end, break_min: r.breakMin, reason: r.reason }));
  },
  async decideRequest(id, ok) { await must(sb.rpc('decide_request', { p_id: id, p_ok: ok })); },
  async saveEntry(e) {
    const row = { start_at: e.start, end_at: e.end, break_min: e.breakMin, break_start: null, note: String(e.note || '').slice(0, 120) };
    if (e.id) await mustChange(sb.from('time_entries').update(row).eq('id', e.id));
    else await must(sb.from('time_entries').insert({ ...row, user_id: e.userId, source: 'Nachtrag' }));
  },

  /* ----- Fehlzeiten ----- */
  async createAbsence(a) {
    await must(sb.from('absences').insert({ user_id: a.userId, type: a.type, date_from: a.from, date_to: a.to, note: a.note, status: a.direct ? 'ok' : 'pending' }));
  },
  async setAbsence(id, status, why) { await mustChange(sb.from('absences').update({ status, why: why || null }).eq('id', id)); },
  async cancelAbsence(id) { await mustChange(sb.from('absences').update({ status: 'no' }).eq('id', id)); },

  /* ----- Einstellungen, Betriebsferien, Personen, Tags ----- */
  async saveSetting(key, value) { await mustChange(sb.from('settings').update({ [SETTING_COLS[key]]: value }).eq('id', 1)); },
  async addClosure(c) { await must(sb.from('closures').insert({ label: c.label, date_from: c.from, date_to: c.to })); },
  async delClosure(id) { await mustChange(sb.from('closures').delete().eq('id', id)); },
  async saveProfile(id, patch) {
    const row = {};
    if ('name' in patch) row.full_name = patch.name;
    if ('active' in patch) row.active = patch.active;
    await mustChange(sb.from('profiles').update(row).eq('id', id));
  },
  async addTag(t) { await must(sb.from('nfc_tags').insert({ uid_hash: t.uidHash, label: t.label, user_id: t.userId })); },
  async setTagActive(id, active) { await mustChange(sb.from('nfc_tags').update({ active }).eq('id', id)); },
  async delTag(id) { await mustChange(sb.from('nfc_tags').delete().eq('id', id)); },

  /* ----- Geschäftstablet ----- */
  kiosk: {
    async configured() { const { data } = await kb.auth.getSession(); return !!data.session; },
    async signIn(email, password) {
      const { error } = await kb.auth.signInWithPassword({ email: String(email).trim(), password });
      if (error) throw friendly(error);
      const role = await must(kb.rpc('my_role'));
      if (role !== 'kiosk') { await kb.auth.signOut(); throw new AppError('Das ist kein Tablet-Konto.'); }
    },
    async signOut() { try { await kb.auth.signOut(); } catch (e) { /* offline */ } },
    stamp: (hash) => must(kb.rpc('kiosk_stamp', { p_tag: hash })),
    async setBreak(entryId, min) { await must(kb.rpc('kiosk_set_break', { p_entry: entryId, p_min: min })); },
  },
};

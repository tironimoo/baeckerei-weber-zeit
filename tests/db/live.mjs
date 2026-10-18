// Prüft die echte Datenschicht (src/api/supabase.js) gegen eine lokale PostgreSQL mit dem echten Schema
// und PostgREST, ohne Supabase-Konto. Start: bash tests/db/run.sh
import { createRequire } from 'node:module';
import { createServer, request as httpRequest } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { createHmac, createHash } from 'node:crypto';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';

const PG = { host: process.env.PGHOST || '/tmp', port: process.env.PGPORT || '5544', user: process.env.PGUSER || 'pgtest', db: 't2' };
const PGREST = process.env.POSTGREST || '/tmp/pgrst/postgrest';
const SECRET = 'test-secret-test-secret-test-secret-123456';
const psql = (db, args, input) => execFileSync('psql', ['-h', PG.host, '-p', PG.port, '-U', PG.user, '-d', db, '-q', '-v', 'ON_ERROR_STOP=1', ...args], { input, encoding: 'utf8' });

/* ---------- Datenbank frisch aufsetzen ---------- */
psql('postgres', ['-c', 'drop database if exists t2', '-c', 'create database t2']);
psql(PG.db, ['-f', 'tests/db/auth-stub.sql']);
psql(PG.db, ['-f', 'supabase/schema.sql']);
const ID = { chef: '00000000-0000-0000-0000-00000000000c', ma: '00000000-0000-0000-0000-0000000000a1', ma2: '00000000-0000-0000-0000-0000000000a2', kiosk: '00000000-0000-0000-0000-0000000000f1' };
const hash = (raw) => createHash('sha256').update('bwz:' + raw.toUpperCase().replace(/[^0-9A-F]/g, '')).digest('hex');
psql(PG.db, [], `
insert into auth.users(id,email,raw_user_meta_data) values
 ('${ID.chef}','chef@x','{"full_name":"Elisabeth Roßner"}'),('${ID.ma}','ma@x','{"full_name":"Lena Bauer"}'),
 ('${ID.ma2}','ma2@x','{"full_name":"Zweite Person"}'),('${ID.kiosk}','tab@x','{"full_name":"Tablet"}');
select count(*) filter (where active) as aktiv_vor_freischaltung from profiles;
update profiles set active=true; update profiles set role='chef' where id='${ID.chef}'; update profiles set role='kiosk' where id='${ID.kiosk}';
insert into nfc_tags(uid_hash,label,user_id) values ('${hash('04:A2:19:7C:3B:5E:80')}','Tag Lena','${ID.ma}');`);
const sqlq = (q) => psql(PG.db, ['-t', '-A', '-c', q]).trim();

/* ---------- PostgREST und kleine Weiche für /rest/v1 und /auth/v1/user ---------- */
const dir = mkdtempSync(join(tmpdir(), 'pgrst-'));
psql('postgres', ['-c', `do $$ begin create role authenticator login noinherit; exception when duplicate_object then null; end $$`]);
psql(PG.db, ['-c', 'grant anon, authenticated to authenticator']);
writeFileSync(join(dir, 'pgrst.conf'), `db-uri = "postgres://authenticator@/${PG.db}?host=${PG.host}&port=${PG.port}"\ndb-schemas = "public"\ndb-anon-role = "anon"\njwt-secret = "${SECRET}"\nserver-port = 3101\nserver-host = "127.0.0.1"\n`);
const pgrst = spawn(PGREST, [join(dir, 'pgrst.conf')], { stdio: 'ignore' });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const mint = (sub, aal = 'aal1', email = 'x@x') => { const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64({ sub, role: 'authenticated', aud: 'authenticated', aal, email, exp: Math.floor(Date.now() / 1000) + 3600 }); return `${h}.${p}.${createHmac('sha256', SECRET).update(h + '.' + p).digest('base64url')}`; };
const tokenOf = (req) => (req.headers.authorization || '').replace('Bearer ', '');
const proxy = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/auth/v1/user') { const c = JSON.parse(Buffer.from(tokenOf(req).split('.')[1], 'base64url')); res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ id: c.sub, aud: 'authenticated', role: 'authenticated', email: c.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() })); }
  if (u.pathname.startsWith('/rest/v1/')) {
    const r = httpRequest({ host: '127.0.0.1', port: 3101, path: u.pathname.replace('/rest/v1', '') + u.search, method: req.method, headers: { ...req.headers, host: '127.0.0.1:3101' } }, (pr) => { res.writeHead(pr.statusCode, pr.headers); pr.pipe(res); });
    return req.pipe(r);
  }
  res.statusCode = 404; res.end();
}).listen(3100, '127.0.0.1');
await new Promise((r) => setTimeout(r, 1500));

/* ---------- Datenschicht bündeln, mit Test-Adresse statt echter ---------- */
const out = join(dir, 'api.mjs');
await build({
  entryPoints: ['src/api/supabase.js'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
  plugins: [{ name: 'cfg', setup(b) { b.onResolve({ filter: /config\.js$/ }, () => ({ path: 'cfg', namespace: 'cfg' })); b.onLoad({ filter: /.*/, namespace: 'cfg' }, () => ({ contents: "export const SUPABASE_URL='http://127.0.0.1:3100';export const SUPABASE_KEY='sb_publishable_test';export const TIME_ZONE='Europe/Berlin';" })); } }],
});
const { api, _clients } = await import(out);

let total = 0, fails = 0;
const ok = (n, c, x = '') => { total++; if (!c) { fails++; console.log('  FEHLER:', n, x); } else console.log('  ok:', n); };
const rejects = async (n, p, re) => { try { await p; ok(n, false, 'wurde nicht abgewiesen'); } catch (e) { ok(n, re ? re.test(e.message) : true, e.message); } };
const login = async (client, id, aal) => { await client.auth.signOut().catch(() => {}); const t = mint(id, aal); const { error } = await client.auth.setSession({ access_token: t, refresh_token: 'r' + id }); if (error) throw error; };
const MA = { role: 'ma', uid: ID.ma }, CHEF = { role: 'chef', uid: ID.chef };

try {
  console.log('Mitarbeiterin');
  await login(_clients.sb, ID.ma, 'aal1');
  let d = await api.loadAll(MA);
  ok('lädt Einstellungen und Betriebsferien', d.settings.weeklyHours === 18 && d.settings.vacationDays === 18 && d.closures.length === 1 && d.closures[0].from === '2027-06-28');
  ok('sieht nur das eigene Profil', d.users.length === 1 && d.users[0].name === 'Lena Bauer');
  ok('sieht keine Tags', d.tags.length === 0);
  let r = await api.selfStamp('Handy'); ok('stempelt ein', r.status === 'in' && r.name === 'Lena');
  r = await api.selfStamp('Handy'); ok('zweites Stempeln sofort: dup', r.status === 'dup');
  r = await api.selfBreak(); ok('Pause startet', r.status === 'break_start');
  r = await api.selfBreak(); ok('Pause endet', r.status === 'break_end');
  d = await api.loadAll(MA); ok('offener Eintrag ist sichtbar', d.entries.length === 1 && !d.entries[0].end && d.entries[0].source === 'Handy');
  await rejects('stempelt nicht für andere', api.stampFor(ID.ma2), /Nur die Chefin/);
  await rejects('hat kein Protokoll', api.loadAudit().then((x) => { if (!x.length) throw new Error('leer'); }), /leer/);
  await rejects('ändert keine Einstellungen', api.saveSetting('wage', 99), /Berechtigung/);
  await rejects('ändert keine Zeiten', api.saveEntry({ id: d.entries[0].id, start: new Date().toISOString(), end: new Date(Date.now() + 60000).toISOString(), breakMin: 0 }), /Berechtigung/);
  sqlq(`update time_entries set start_at=now()-interval '5 hours', break_min=0, break_start=null where user_id='${ID.ma}' and end_at is null`);
  r = await api.selfStamp('Handy'); ok('stempelt aus', r.status === 'out' && r.net_min >= 299 && r.net_min <= 301);
  await api.selfSetBreak(r.entry_id, 30); d = await api.loadAll(MA); ok('Pause nachträglich 30', d.entries[0].breakMin === 30);
  await api.createRequest({ userId: ID.ma, entryId: null, date: '2026-10-10', start: '06:00', end: '11:30', breakMin: 30, reason: 'Vergessen' });
  await api.createAbsence({ userId: ID.ma, type: 'krank', from: '2026-10-20', to: '2026-10-22', note: 'Arzt', direct: false });
  d = await api.loadAll(MA); ok('Antrag und Krankmeldung wartend', d.requests[0].status === 'pending' && d.requests[0].start === '06:00' && d.absences[0].status === 'pending');
  await rejects('Fehlzeit nicht selbst bestätigen', api.setAbsence(d.absences[0].id, 'ok', ''), /zurückziehen|Berechtigung/);
  await api.cancelAbsence(d.absences[0].id); d = await api.loadAll(MA); ok('Krankmeldung zurückgezogen', d.absences[0].status === 'no' && d.absences[0].why === 'Zurückgezogen');
  await api.createAbsence({ userId: ID.ma, type: 'urlaub', from: '2026-11-02', to: '2026-11-04', note: '', direct: false });

  console.log('Chefin ohne Authenticator (aal1)');
  await login(_clients.sb, ID.chef, 'aal1');
  d = await api.loadAll(CHEF); ok('sieht nur das eigene Profil und keine fremden Zeiten', d.users.length === 1 && d.entries.length === 0);
  await rejects('kann nichts ändern', api.saveSetting('wage', 99), /Berechtigung/);
  await rejects('kann nicht für andere stempeln', api.stampFor(ID.ma), /Nur die Chefin/);

  console.log('Chefin mit Authenticator (aal2)');
  await login(_clients.sb, ID.chef, 'aal2');
  d = await api.loadAll(CHEF);
  ok('sieht alle Profile, Zeiten und Tags', d.users.length === 4 && d.entries.length === 1 && d.tags.length === 1);
  const req = d.requests.find((x) => x.status === 'pending');
  await api.decideRequest(req.id, true); d = await api.loadAll(CHEF);
  ok('Nachtrag wurde Eintrag (Berliner Zeit)', d.entries.some((e) => e.source === 'Nachtrag' && new Date(e.start).toISOString() === '2026-10-10T04:00:00.000Z'));
  const abs = d.absences.find((a) => a.status === 'pending'); await api.setAbsence(abs.id, 'ok', ''); d = await api.loadAll(CHEF); ok('Urlaub bestätigt', d.absences.find((a) => a.id === abs.id).status === 'ok');
  await api.createAbsence({ userId: ID.ma, type: 'sonst', from: '2026-12-01', to: '2026-12-01', note: '', direct: true }); d = await api.loadAll(CHEF); ok('Fehlzeit direkt eingetragen', d.absences.some((a) => a.type === 'sonst' && a.status === 'ok'));
  await api.saveSetting('wage', 14.5); await api.saveSetting('vacationDays', 20); d = await api.loadAll(CHEF); ok('Einstellungen gespeichert', d.settings.wage === 14.5 && d.settings.vacationDays === 20);
  await api.addClosure({ label: 'Weihnachten', from: '2026-12-24', to: '2026-12-31' }); d = await api.loadAll(CHEF); ok('Betriebsferien hinzugefügt', d.closures.length === 2);
  await api.delClosure(d.closures.find((c) => c.label === 'Weihnachten').id); d = await api.loadAll(CHEF); ok('Betriebsferien entfernt', d.closures.length === 1);
  await api.saveProfile(ID.ma2, { name: 'Zweite P.' }); d = await api.loadAll(CHEF); ok('Name geändert', d.users.find((u) => u.id === ID.ma2).name === 'Zweite P.');
  await rejects('Rolle lässt sich nicht über die App ändern', _clients.sb.from('profiles').update({ role: 'chef' }).eq('id', ID.ma).then((x) => { if (x.error) throw x.error; }), /App ändert|Rolle/);
  await api.addTag({ uidHash: hash('04:11:22:33:44:55:66'), label: 'Zweiter', userId: ID.ma2 }); d = await api.loadAll(CHEF); ok('Tag angelernt', d.tags.length === 2);
  const t2 = d.tags.find((t) => t.label === 'Zweiter'); await api.setTagActive(t2.id, false); await api.setTagActive(t2.id, true); await api.delTag(t2.id); d = await api.loadAll(CHEF); ok('Tag gesperrt, entsperrt, gelöscht', d.tags.length === 1);
  const e0 = d.entries.find((e) => e.source === 'Handy');
  await api.saveEntry({ id: e0.id, start: e0.start, end: e0.end, breakMin: 45, note: 'geändert: Test' }); d = await api.loadAll(CHEF); ok('Zeit korrigiert', d.entries.find((e) => e.id === e0.id).breakMin === 45);
  await api.saveEntry({ id: null, userId: ID.ma2, start: '2026-10-01T04:00:00Z', end: '2026-10-01T09:00:00Z', breakMin: 0, note: 'Nachtrag: Test' }); d = await api.loadAll(CHEF); ok('Zeit nachgetragen', d.entries.some((e) => e.userId === ID.ma2));
  sqlq(`update time_entries set start_at=start_at-interval '1 day', end_at=end_at-interval '1 day' where user_id='${ID.ma}'`);
  r = await api.stampFor(ID.ma); ok('Chefin stempelt für Mitarbeiterin', r.status === 'in');
  r = await api.breakFor(ID.ma); ok('Chefin startet Pause für Mitarbeiterin', r.status === 'break_start');
  const au = await api.loadAudit(); ok('Protokoll gefüllt und lesbar', au.length > 10 && au.some((a) => a.tbl === 'time_entries') && au.some((a) => a.tbl === 'settings'));

  console.log('Tablet');
  await login(_clients.kb, ID.kiosk, 'aal1');
  ok('erkennt Tablet-Konto', true);
  sqlq(`delete from time_entries where user_id='${ID.ma}' and end_at is null; update time_entries set start_at=start_at-interval '1 day', end_at=end_at-interval '1 day' where user_id='${ID.ma}'`);
  r = await api.kiosk.stamp('unbekannt'); ok('unbekannter Tag', r.status === 'unknown');
  r = await api.kiosk.stamp(hash('04:A2:19:7C:3B:5E:80')); ok('Einstempeln per Tag', r.status === 'in' && r.name === 'Lena');
  r = await api.kiosk.stamp(hash('04:A2:19:7C:3B:5E:80')); ok('Doppeltes Auflegen: dup', r.status === 'dup');
  sqlq(`update time_entries set start_at=now()-interval '7 hours' where user_id='${ID.ma}' and end_at is null`);
  r = await api.kiosk.stamp(hash('04:A2:19:7C:3B:5E:80')); ok('Ausstempeln mit Auto-Pause 30', r.status === 'out' && r.break_min === 30);
  await api.kiosk.setBreak(r.entry_id, 45); ok('Pause am Tablet ändern', sqlq(`select break_min from time_entries where id='${r.entry_id}'`) === '45');
  await rejects('Tablet kann keine Zeiten lesen', _clients.kb.from('time_entries').select('*').then((x) => { if (x.error) throw x.error; if (!x.data.length) throw new Error('leer'); }), /leer/);
  await rejects('Tablet kann nicht als Person stempeln', _clients.kb.rpc('self_stamp', { p_source: 'Tablet' }).then((x) => { if (x.error) throw x.error; }), /Nicht erlaubt/);
  ok('Tablet-Stempel steht im Protokoll', sqlq("select count(*) from audit_log where tbl='time_entries' and actor_name='Tablet'") > 0);

  console.log('Ohne Anmeldung');
  const anon = await fetch('http://127.0.0.1:3100/rest/v1/time_entries?select=*', { headers: { apikey: 'x' } });
  ok('anonym wird abgewiesen', anon.status === 401 || anon.status === 403, 'Status ' + anon.status);
  const anon2 = await fetch('http://127.0.0.1:3100/rest/v1/rpc/kiosk_stamp', { method: 'POST', headers: { apikey: 'x', 'content-type': 'application/json' }, body: '{"p_tag":"x"}' });
  ok('anonym darf nicht stempeln', anon2.status === 401 || anon2.status === 403 || anon2.status === 404, 'Status ' + anon2.status);
} catch (e) { fails++; console.log('ABBRUCH:', e.stack || e); }

pgrst.kill(); proxy.close();
console.log(`\n${total - fails} von ${total} Prüfungen bestanden`);
process.exit(fails ? 1 : 0);

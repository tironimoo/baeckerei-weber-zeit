// Klick-Test im Übungsmodus (?demo). Start: npm test   (braucht Playwright und einen gebauten dist-Ordner)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = 4173, APP_URL = `http://localhost:${PORT}/?demo`;
const server = spawn('python3', ['-m', 'http.server', String(PORT), '-d', 'dist', '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

let fails = 0, total = 0;
const ok = (name, cond, extra = '') => { total++; if (!cond) { fails++; console.log('  FEHLER:', name, extra); } else console.log('  ok:', name); };
const errors = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });

async function open(viewport, shots) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.goto(APP_URL);
  await page.waitForSelector('#app .shell');
  return { page, ctx, shot: (n) => page.screenshot({ path: `tests/out/${shots}-${n}.png`, fullPage: true }) };
}
const text = (page) => page.evaluate(() => document.body.innerText);
const click = async (page, sel) => { await page.click(sel); await page.waitForTimeout(120); };
const login = async (page, em, pw) => { await page.fill('#em', em); await page.fill('#pw', pw); await page.click('#login-form button[type=submit]'); await page.waitForTimeout(300); };
const shift = (page, m) => page.evaluate((x) => window.__bwz.api._debug.shift(x), m);
import { mkdirSync } from 'node:fs';
mkdirSync('tests/out', { recursive: true });

/* ---------------- Handy: Mitarbeiterin ---------------- */
console.log('Handy: Mitarbeiterin');
{
  const { page, shot, ctx } = await open({ width: 390, height: 844 }, 'phone');
  ok('Anmeldeseite sichtbar', (await text(page)).includes('Anmelden'));
  await login(page, 'lena@demo', 'falsch');
  ok('falsches Passwort wird abgewiesen', (await text(page)).includes('E-Mail oder Passwort stimmt nicht'));
  await login(page, 'lena@demo', 'backen');
  let t = await text(page);
  ok('Heute-Ansicht mit Namen', t.includes('Lena') && t.includes('Kommen'));
  ok('Wochensoll 18 Std. sichtbar', t.includes('18:00'));
  await shot('1-heute');
  await click(page, '[data-act=stamp]');
  t = await text(page);
  ok('Eingestempelt', t.includes('Im Dienst seit'));
  await click(page, '[data-act=stamp]');
  ok('Zu schnelles Ausstempeln wird gebremst', (await text(page)).includes('Gerade erst gestempelt'));
  await page.waitForTimeout(3300);
  await click(page, '[data-act=pause]'); ok('Pause läuft', (await text(page)).includes('In Pause'));
  await click(page, '[data-act=pause]'); ok('Pause beendet', (await text(page)).includes('Im Dienst seit'));
  await shift(page, 300); await page.evaluate(() => window.__bwz.render());
  await click(page, '[data-act=stamp]');
  t = await text(page);
  ok('Feierabend-Fenster mit Pausenwahl', t.includes('Schönen Feierabend') && t.includes('Wie lang war deine Pause'));
  await shot('2-feierabend');
  await click(page, '[data-act=setBreak][data-m="30"]');
  ok('Pause 30 gewählt', await page.evaluate(() => document.querySelector('[data-act=setBreak][data-m="30"]').classList.contains('on')));
  await click(page, '[data-act=closeDone]');
  /* Krank melden */
  await click(page, '[data-act=openAbs][data-ty=krank]');
  await shot('3-krank');
  await page.fill('#a-to', await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 2); return d.toISOString().slice(0, 10); }));
  await click(page, '[data-act=submitAbs]');
  t = await text(page);
  ok('Krankmeldung wartet auf Bestätigung', t.includes('Wartet auf Bestätigung'));
  /* Korrektur beantragen */
  await click(page, '[data-act=tab][data-t=times]');
  t = await text(page);
  ok('Zeiten-Ansicht zeigt Urlaubskonto', /urlaubskonto/i.test(t));
  await click(page, '.item [data-act=openReq] >> nth=0');
  await page.fill('#f-reason', 'Test Korrektur');
  await click(page, '[data-act=submitEntry]');
  await page.waitForTimeout(200);
  ok('Korrekturantrag gesendet, Dialog zu', !(await page.$('.sheet')) && (await text(page)).includes('Korrektur'));
  await click(page, '[data-act=openReq][data-u]');
  await page.fill('#f-date', await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }));
  await page.fill('#f-start', '06:00'); await page.fill('#f-end', '12:00'); await page.fill('#f-break', '30');
  await page.fill('#f-reason', 'Vergessen');
  await click(page, '[data-act=submitEntry]');
  ok('Nachtrag beantragt, Dialog zu', !(await page.$('.sheet')));
  await shot('4-zeiten');
  /* Passwort ändern: zu kurz */
  await click(page, '[data-act=openAccount]');
  await page.fill('#pw1', 'kurz'); await page.fill('#pw2', 'kurz'); await click(page, '[data-act=savePassword]');
  ok('Kurzes Passwort wird abgelehnt', (await text(page)).includes('mindestens 10 Zeichen'));
  await click(page, 'button[data-act=closeModal]');
  await click(page, '[data-act=logout]');
  ok('Abgemeldet', (await text(page)).includes('Anmelden'));
  await ctx.close();
}

/* ---------------- Tablet: Stempeln per NFC und Chefin ---------------- */
console.log('Tablet: NFC und Chefin');
{
  const { page, shot, ctx } = await open({ width: 1100, height: 800 }, 'tablet');
  let t = await text(page);
  ok('Tablet zeigt Stempelstation', t.includes('Tag an das Tablet halten'));
  const kioskText = await page.evaluate(() => { const c = document.querySelector('.kiosk').cloneNode(true); c.querySelector('.simbox')?.remove(); return c.innerText; });
  ok('Keine Namen oder Zeiten am Tablet sichtbar', !kioskText.includes('Lena') && !kioskText.includes('Std.'));
  await shot('1-kiosk');
  await click(page, '[data-act=nfcSim][data-k="0"]');
  ok('Unbekannter Tag wird abgewiesen', (await text(page)).includes('Tag nicht bekannt'));
  await click(page, '[data-act=closeDone]');
  await click(page, '[data-act=nfcSim][data-k="1"]');
  t = await text(page);
  ok('Einstempeln per Tag', t.includes('Eingestempelt um') && t.includes('Lena'));
  await shot('2-eingestempelt');
  await click(page, '[data-act=closeDone]');
  await shift(page, 400);
  await page.evaluate(() => { window.__bwz.V.done = null; });
  await page.waitForTimeout(8300);
  await click(page, '[data-act=nfcSim][data-k="1"]');
  t = await text(page);
  ok('Ausstempeln per Tag mit Pause automatisch', t.includes('Schönen Feierabend') && t.includes('Heute gearbeitet'));
  ok('Automatische Pause 30 Min. ausgewählt', await page.evaluate(() => document.querySelector('[data-act=setBreak][data-m="30"]').classList.contains('on')));
  await click(page, '[data-act=setBreak][data-m="45"]');
  ok('Pause am Tablet änderbar', await page.evaluate(() => document.querySelector('[data-act=setBreak][data-m="45"]').classList.contains('on')));
  await click(page, '[data-act=closeDone]');
  /* Chefin */
  await click(page, '[data-act=goLogin]');
  await login(page, 'chefin@demo', 'chefin');
  ok('Chefin braucht zweiten Faktor', (await text(page)).includes('Zweiter Schritt'));
  await page.fill('#code', '000000'); await page.click('#mfa-form button[type=submit]'); await page.waitForTimeout(250);
  ok('Falscher Code wird abgewiesen', (await text(page)).includes('Der Code stimmt nicht'));
  await page.fill('#code', '123456'); await page.click('#mfa-form button[type=submit]'); await page.waitForTimeout(300);
  t = await text(page);
  ok('Chefin-Übersicht', /übersicht/i.test(t) && /offene anträge/i.test(t));
  ok('Anträge-Zähler zeigt offene Punkte', await page.evaluate(() => !!document.querySelector('.badge')));
  await shot('3-chef');
  await click(page, '[data-act=tab][data-t=requests]');
  await click(page, '[data-act=approve]');
  await click(page, '[data-act=tab][data-t=settings]');
  await shot('4-einstellungen');
  ok('Betriebsferien Hessen 2027 eingetragen', (await text(page)).includes('28.06.2027'));
  ok('Urlaubskonto zeigt 18 Tage Anspruch', /urlaubskonto/i.test(await text(page)) && /Anspruch\s*18/i.test(await text(page)));
  await page.fill('[data-set=wage]', '14.5'); await page.dispatchEvent('[data-set=wage]', 'change'); await page.waitForTimeout(250);
  ok('Stundenlohn änderbar', (await page.inputValue('[data-set=wage]')) === '14.5');
  await page.fill('[data-person=ma1]', 'Lena Bauer-Test'); await page.dispatchEvent('[data-person=ma1]', 'change'); await page.waitForTimeout(250);
  await page.fill('#c-from', '2027-12-24'); await page.fill('#c-to', '2027-12-31'); await click(page, '[data-act=closureAdd]');
  ok('Betriebsferien hinzugefügt', (await text(page)).includes('24.12.2027'));
  await click(page, '[data-act=tab][data-t=tags]');
  await click(page, '[data-act=openTag]'); await click(page, '[data-act=tagSim]'); await page.fill('#t-label', 'Zweiter Tag'); await click(page, '[data-act=tagSave]');
  ok('Tag angelernt', (await text(page)).includes('Zweiter Tag'));
  await click(page, '[data-act=tab][data-t=audit]');
  t = await text(page);
  ok('Protokoll zeigt Stempel und Änderungen', t.includes('Eingestempelt') && t.includes('Ausgestempelt') && t.includes('Tag angelernt'));
  await shot('5-protokoll');
  /* Chefin stempelt für Mitarbeiterin */
  await click(page, '[data-act=tab][data-t=overview]');
  await click(page, '[data-act=actAs]');
  t = await text(page);
  ok('Chefin sieht Konto der Mitarbeiterin mit Hinweis', t.includes('Die Chefin stempelt für') && t.includes('Kommen'));
  await shift(page, 5);
  await click(page, '[data-act=stamp]');
  ok('Chefin stempelt ein', (await text(page)).includes('Im Dienst seit'));
  await click(page, '[data-act=stopActing]');
  /* Export */
  await click(page, '[data-act=tab][data-t=times]');
  await click(page, '[data-act=csv]');
  ok('Monatsliste lässt sich anzeigen', (await page.inputValue('#csv-t')).startsWith('Datum;Beginn;Ende'));
  await shot('6-export');
  await click(page, 'button[data-act=closeModal]');
  await click(page, '[data-act=logout]');
  ok('Nach Abmelden wieder Stempelstation', (await text(page)).includes('Tag an das Tablet halten'));
  await ctx.close();
}

/* ---------------- Sicherheit der Oberfläche ---------------- */
console.log('Sicherheit');
{
  const { page, ctx } = await open({ width: 390, height: 844 }, 'sec');
  await login(page, 'lena@demo', 'backen');
  const r = await page.evaluate(async () => {
    const out = {};
    try { await window.__bwz.api.stampFor('ma1'); out.stampFor = 'erlaubt'; } catch (e) { out.stampFor = 'abgewiesen'; }
    try { await window.__bwz.api.decideRequest('x', true); out.decide = 'erlaubt'; } catch (e) { out.decide = 'abgewiesen'; }
    try { await window.__bwz.api.loadAudit(); out.audit = 'erlaubt'; } catch (e) { out.audit = 'abgewiesen'; }
    return out;
  });
  ok('Mitarbeiterin darf nicht für andere stempeln', r.stampFor === 'abgewiesen');
  ok('Mitarbeiterin darf keine Anträge entscheiden', r.decide === 'abgewiesen');
  ok('Mitarbeiterin sieht kein Protokoll', r.audit === 'abgewiesen');
  const txt = await text(page);
  ok('Mitarbeiterin sieht keine Chefin-Reiter', !txt.includes('NFC-Tags') && !txt.includes('Protokoll'));
  await page.evaluate(() => { window.__bwz.api.reset && 0; });
  await ctx.close();
}


/* ---------------- Systemprüfung (Supabase wird nachgestellt) ---------------- */
console.log('Systemprüfung');
async function checkWith(handler) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.route('https://mwhpoeevjwpvqmjyczrk.supabase.co/**', (route) => {
    const u = new URL(route.request().url());
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const r = handler(u.pathname);
    if (!r) return route.abort();
    return route.fulfill({ status: r[0], headers: cors, body: JSON.stringify(r[1]) });
  });
  await page.goto(`http://localhost:${PORT}/?check`);
  await page.waitForFunction(() => document.body.innerText.includes('Alles in Ordnung') || document.body.innerText.includes('Etwas fehlt'), null, { timeout: 15000 });
  const t = await text(page);
  await page.screenshot({ path: 'tests/out/check.png', fullPage: true });
  await ctx.close();
  return t;
}
{
  let t = await checkWith((p) => p.endsWith('/auth/v1/settings') ? [200, { disable_signup: true }] : p.includes('/rpc/') ? [401, { code: '42501', message: 'permission denied for function kiosk_stamp' }] : [401, { code: '42501', message: 'permission denied for table settings' }]);
  ok('Alles richtig eingerichtet: grüne Prüfung', t.includes('Alles in Ordnung') && !t.includes('Fehler'));
  t = await checkWith((p) => p.endsWith('/auth/v1/settings') ? [200, { disable_signup: false }] : p.includes('/rpc/') ? [404, { code: 'PGRST202', message: 'Could not find the function' }] : [404, { code: 'PGRST205', message: 'Could not find the table public.settings in the schema cache' }]);
  ok('Fehlendes SQL und offene Selbst-Anmeldung werden gemeldet', t.includes('Etwas fehlt') && t.includes('Noch an!') && t.includes('Tabellen fehlen') && t.includes('Funktionen fehlen'));
  t = await checkWith((p) => p.endsWith('/auth/v1/settings') ? [200, { disable_signup: true }] : p.includes('/rpc/') ? [401, { code: '42501' }] : [200, []]);
  ok('Ohne Anmeldung lesbare Tabellen werden gemeldet', t.includes('Ohne Anmeldung lesbar'));
  t = await checkWith(() => null);
  ok('Nicht erreichbarer Server wird gemeldet', t.includes('Keine Verbindung zu mwhpoeevjwpvqmjyczrk.supabase.co'));
}

await browser.close(); server.kill();
const real = errors.filter((e) => !/favicon|Download the React/.test(e));
ok('Keine Fehlermeldungen in der Konsole', real.length === 0, '\n' + real.join('\n'));
console.log(`\n${total - fails} von ${total} Prüfungen bestanden`);
process.exit(fails ? 1 : 0);

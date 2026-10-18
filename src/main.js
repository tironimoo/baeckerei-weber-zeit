import { S, V } from './store.js';
import { api, isDemo, DEMO_TAG_UID, DEMO_UNKNOWN_UID } from './api/index.js';
import { $, dkey, esc, fmtD, fmtT, pad, tagHash, pd, mkey } from './util.js';
import { absDates, ABS, userById } from './calc.js';
import { viewer, isChef, sourceName } from './session.js';
import { loginView, mfaView, enrollView, setupView, kioskView } from './views/auth.js';
import { appView, demoBar } from './views/shell.js';
import { modalHtml, overlayHtml, csvText } from './views/modals.js';
import { todayMin } from './calc.js';
import { hm } from './util.js';

/* ============================== Anzeige ============================== */
function render() {
  const app = $('#app');
  let body;
  if (V.boot === 'loading') body = '<div class="splash"><div class="logo big-logo"></div><p class="muted">Lädt …</p></div>';
  else if (V.boot === 'mfa') body = mfaView();
  else if (V.boot === 'enroll') body = enrollView();
  else if (V.boot === 'app') body = appView();
  else if (V.screen === 'setup') body = setupView();
  else if (V.screen === 'login' || V.device !== 'tablet') body = loginView();
  else body = kioskView();
  app.innerHTML = demoBar() + '<div class="shell">' + body + '</div>' + modalHtml() + overlayHtml() + (V.toast ? `<div class="toast" role="status">${esc(V.toast)}</div>` : '');
  document.title = S.settings.business ? S.settings.business + ' Zeit' : 'Zeiterfassung';
}
let toastTimer = null;
function toast(t) { V.toast = t; render(); clearTimeout(toastTimer); toastTimer = setTimeout(() => { V.toast = null; render(); }, 3200); }
const typing = () => { const a = document.activeElement; return a && /INPUT|SELECT|TEXTAREA/.test(a.tagName); };

/* ============================== Daten ============================== */
async function reload() {
  if (!V.session) return;
  Object.assign(S, await api.loadAll(V.session));
  if (isChef() && V.tab === 'audit') S.audit = await api.loadAudit();
}
function wipe() { Object.assign(S, { users: [], entries: [], requests: [], absences: [], tags: [], audit: [] }); }

async function applyAuth(r) {
  V.err = '';
  if (r.error) V.err = r.error;
  if (r.state === 'login') { V.boot = 'login'; V.session = null; return; }
  V.pending = r;
  if (r.state === 'mfa') { V.boot = 'mfa'; return; }
  if (r.state === 'enroll') { V.mfa = await api.mfaEnroll(); V.boot = 'enroll'; return; }
  V.session = { ...r.session, actingAs: null };
  V.tab = V.session.role === 'chef' ? 'overview' : 'today';
  V.lastAct = Date.now();
  await reload();
  V.boot = 'app';
}

/* Bei jeder Aktion: Fehler freundlich melden, danach neu laden und anzeigen. */
async function run(fn, { reloadAfter = true, silent = false } = {}) {
  if (V.busy) return;
  V.busy = true;
  try {
    await fn();
    if (reloadAfter && V.session) await reload();
  } catch (e) {
    if (!silent) { V.busy = false; toast(e.message || 'Das hat nicht geklappt.'); return; }
  }
  V.busy = false;
  render();
}

/* ============================== Stempeln ============================== */
function showDone(d, ms) {
  clearTimeout(V.doneTimer); V.done = d; render();
  V.doneTimer = setTimeout(() => { V.done = null; render(); }, ms);
  try { navigator.vibrate && navigator.vibrate(d.type === 'unknown' || d.type === 'blocked' || d.type === 'error' ? [80, 60, 80] : 40); } catch (e) { /* egal */ }
}
let lastTag = { h: '', t: 0 };
async function onTag(raw) {
  if (V.session || V.done) return;
  let hash;
  try { hash = await tagHash(raw); } catch (e) { return showDone({ type: 'unknown' }, 6000); }
  if (hash === lastTag.h && Date.now() - lastTag.t < 8000) return;
  lastTag = { h: hash, t: Date.now() };
  try {
    const r = await api.kiosk.stamp(hash);
    showDone({ ...r, type: r.status }, r.status === 'out' ? 15000 : 6000);
  } catch (e) { showDone({ type: 'error', message: e.message }, 7000); }
}

let reader = null, wakeLock = null;
async function nfcStart() {
  if (!('NDEFReader' in window)) { toast('NFC wird hier nicht unterstützt. Bitte Chrome auf Android nutzen.'); return; }
  try {
    reader = new NDEFReader();
    await reader.scan();
    reader.onreading = (ev) => onTag(ev.serialNumber);
    reader.onreadingerror = () => toast('Der Tag konnte nicht gelesen werden.');
    V.nfcActive = true; render();
  } catch (e) { V.nfcActive = false; toast('NFC konnte nicht gestartet werden. Ist NFC am Tablet eingeschaltet?'); }
}
async function keepAwake() {
  try { if (V.device === 'tablet' && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { /* nicht schlimm */ }
}
async function autoNfc() {
  if (V.device !== 'tablet' || isDemo || V.nfcActive || !('NDEFReader' in window)) return;
  try { const p = await navigator.permissions.query({ name: 'nfc' }); if (p.state === 'granted') nfcStart(); } catch (e) { /* manuell starten */ }
}

let tagScan = null;
async function startTagScan() {
  if (!('NDEFReader' in window)) return;
  try {
    tagScan = new AbortController();
    const r = new NDEFReader();
    await r.scan({ signal: tagScan.signal });
    r.onreading = (ev) => { if (V.modal && V.modal.type === 'tag' && !V.modal.uid) { V.modal.uid = ev.serialNumber; render(); } };
  } catch (e) { /* dann Nummer von Hand */ }
}
function stopTagScan() { try { tagScan && tagScan.abort(); } catch (e) { /* egal */ } tagScan = null; }

/* ============================== Formulare ============================== */
function entryForm() {
  const date = $('#f-date').value, st = $('#f-start').value, en = $('#f-end').value, br = parseInt($('#f-break').value || '0', 10), rs = $('#f-reason').value.trim();
  if (!date || !st || !en) return { err: 'Bitte Datum, Beginn und Ende angeben.' };
  const a = new Date(date + 'T' + st), b = new Date(date + 'T' + en);
  if (!(b > a)) return { err: 'Das Ende muss nach dem Beginn liegen.' };
  if ((b - a) / 3600000 > 16) return { err: 'Ein Eintrag darf höchstens 16 Stunden dauern.' };
  if (isNaN(br) || br < 0 || br > 180 || br * 60000 >= (b - a)) return { err: 'Die Pause passt nicht zur Arbeitszeit.' };
  if (b > new Date()) return { err: 'Zeiten in der Zukunft sind nicht erlaubt.' };
  if (rs.length < 3) return { err: 'Bitte einen kurzen Grund angeben.' };
  return { date, st, en, a, b, br, rs };
}
function keepValues(ids, apply) {
  const keep = ids.map((id) => [id, $('#' + id) && $('#' + id).value]);
  apply(); render();
  keep.forEach(([id, v]) => { if ($('#' + id) && v != null) $('#' + id).value = v; });
}
const SETTING_LIMITS = { weeklyHours: [1, 40], workDays: [1, 6], wage: [0, 100], idleSec: [15, 600], vacationDays: [0, 60] };

/* ============================== Aktionen ============================== */
const ACT = {
  noop() {},
  device(d) { V.device = d.d; V.screen = 'home'; render(); },
  async reset() { if (api.reset) { await api.reset(); await logoutLocal(); render(); } },
  goLogin() { V.screen = 'login'; V.err = ''; render(); },
  goHome() { V.screen = 'home'; V.err = ''; render(); },
  async setupKiosk() { if (V.session) await logout(); V.screen = 'setup'; V.err = ''; render(); },
  async endKiosk() { await api.kiosk.signOut(); V.device = 'phone'; V.nfcActive = false; toast('Tablet-Modus beendet.'); },
  async cancelLogin() { await api.signOut(); V.boot = 'login'; V.session = null; V.err = ''; V.mfa = null; render(); },
  logout() { logout(); },
  tab(d) { V.tab = d.t; if (d.t === 'audit') return run(async () => { S.audit = await api.loadAudit(); }, { reloadAfter: false }); render(); },
  month(d) { const [y, m] = V.month.split('-').map(Number); V.month = mkey(new Date(y, m - 1 + (+d.d), 1)); render(); },

  async stamp() {
    const vw = viewer();
    await run(async () => {
      const r = vw.acting ? await api.stampFor(vw.uid) : await api.selfStamp(sourceName());
      await reload();
      if (r.status === 'out' && !vw.acting) { V.done = { ...r, type: 'out' }; }
      else if (r.status === 'out') toast(`Ausgestempelt um ${fmtT(new Date(r.end))} Uhr, Pause ${r.break_min} Min.`);
      else if (r.status === 'in') toast(`Eingestempelt um ${fmtT(new Date(r.start))} Uhr`);
      else if (r.status === 'dup') toast('Gerade erst gestempelt. Bitte kurz warten.');
      else if (r.status === 'stale') toast('Das Ende vom letzten Eintrag fehlt. Bitte zuerst nachtragen.');
      else toast('Stempeln ist nicht möglich.');
    }, { reloadAfter: false });
  },
  async pause() { const vw = viewer(); await run(() => (vw.acting ? api.breakFor(vw.uid) : api.selfBreak())); },
  async setBreak(d) {
    await run(async () => {
      const min = +d.m;
      if (V.session) await api.selfSetBreak(d.e, min); else await api.kiosk.setBreak(d.e, min);
      if (V.done && V.done.entry_id === d.e) { V.done.break_min = min; V.done.net_min = Math.round((new Date(V.done.end) - new Date(V.done.start)) / 60000 - min); }
    }, { reloadAfter: !!V.session });
  },
  closeDone() { clearTimeout(V.doneTimer); V.done = null; render(); },
  async actAs(d) { V.session.actingAs = d.u; V.tab = 'today'; render(); },
  stopActing() { V.session.actingAs = null; V.tab = 'overview'; render(); },

  openReq(d) { V.modal = { type: 'entry', mode: 'request', eid: d.e || null, uid: d.u || viewer().uid, err: '' }; render(); },
  openEdit(d) { V.modal = { type: 'entry', mode: 'edit', eid: d.e || null, uid: d.u || (viewer().role === 'ma' ? viewer().uid : (S.users.find((u) => u.role === 'ma') || {}).id), err: '' }; render(); },
  closeModal() { stopTagScan(); V.modal = null; render(); },
  async submitEntry() {
    const m = V.modal, f = entryForm();
    if (f.err) { keepValues(['f-date', 'f-start', 'f-end', 'f-break', 'f-reason'], () => { m.err = f.err; }); return; }
    const u = $('#f-user').value, e = m.eid ? S.entries.find((x) => x.id === m.eid) : null;
    await run(async () => {
      if (m.mode === 'request') {
        await api.createRequest({ userId: u, entryId: m.eid, date: f.date, start: f.st, end: f.en, breakMin: f.br, reason: f.rs });
        V.modal = null; V.toast = 'Antrag gesendet. Die Chefin bestätigt ihn.';
      } else {
        await api.saveEntry({ id: e ? e.id : null, userId: u, start: f.a.toISOString(), end: f.b.toISOString(), breakMin: f.br, note: (e ? 'geändert: ' : 'Nachtrag: ') + f.rs });
        V.modal = null; V.toast = 'Gespeichert und protokolliert.';
      }
    });
    if (V.toast && !V.modal) setTimeout(() => { V.toast = null; render(); }, 3000);
  },
  async approve(d) { await run(() => api.decideRequest(d.r, true)); },
  async reject(d) { await run(() => api.decideRequest(d.r, false)); },

  openAbs(d) { V.modal = { type: 'abs', ty: d.ty || 'krank', uid: d.u || viewer().uid, direct: isChef(), err: '' }; render(); },
  async submitAbs() {
    const m = V.modal, ty = $('#a-type').value, from = $('#a-from').value, to = $('#a-to').value, note = $('#a-note').value.trim(), u = $('#a-user').value;
    let err = '';
    if (!from || !to) err = 'Bitte Von und Bis angeben.';
    else if (to < from) err = 'Das Ende darf nicht vor dem Beginn liegen.';
    else if ((pd(to) - pd(from)) / 864e5 > 60) err = 'Eine Fehlzeit darf höchstens 60 Tage umfassen.';
    else if (!absDates({ from, to }).length) err = 'Alle Tage liegen auf Sonntagen oder in den Betriebsferien.';
    if (err) { keepValues(['a-type', 'a-from', 'a-to', 'a-note'], () => { m.ty = ty; m.err = err; }); return; }
    await run(async () => {
      await api.createAbsence({ userId: u, type: ty, from, to, note, direct: m.direct });
      V.modal = null;
      V.toast = m.direct ? 'Gespeichert und protokolliert.' : (ty === 'krank' ? 'Krankmeldung gesendet. Gute Besserung!' : 'Antrag gesendet. Die Chefin bestätigt ihn.');
    });
    setTimeout(() => { V.toast = null; render(); }, 3200);
  },
  async absApprove(d) { await run(() => api.setAbsence(d.a, 'ok', '')); },
  async absReject(d) { await run(() => api.setAbsence(d.a, 'no', 'Abgelehnt')); },
  async absCancel(d) { await run(() => (isChef() ? api.setAbsence(d.a, 'no', 'Storniert') : api.cancelAbsence(d.a))); },

  async closureAdd() {
    const f = $('#c-from').value, t = $('#c-to').value, l = $('#c-label').value.trim() || 'Betriebsferien';
    if (!f || !t || t < f) { toast('Bitte Von und Bis richtig angeben.'); return; }
    await run(() => api.addClosure({ label: l, from: f, to: t }));
  },
  async closureDel(d) { await run(() => api.delClosure(d.c)); },
  async personToggle(d) { const u = userById(d.p); await run(() => api.saveProfile(d.p, { active: !u.active })); },

  openTag() { V.modal = { type: 'tag', uid: '', err: '' }; render(); startTagScan(); },
  tagSim() { V.modal.uid = DEMO_UNKNOWN_UID; render(); },
  async tagSave() {
    const m = V.modal, raw = m.uid || ($('#t-uid') && $('#t-uid').value.trim()), label = $('#t-label').value.trim() || 'Tag', usr = $('#t-user').value;
    if (!raw) { keepValues(['t-label', 't-user'], () => { m.err = 'Bitte zuerst einen Tag scannen oder die Nummer eintragen.'; }); return; }
    let hash;
    try { hash = await tagHash(raw); } catch (e) { keepValues(['t-label', 't-user'], () => { m.err = e.message; }); return; }
    if (!usr) { keepValues(['t-label'], () => { m.err = 'Es gibt noch keine Mitarbeiterin.'; }); return; }
    stopTagScan();
    await run(async () => { await api.addTag({ uidHash: hash, label, userId: usr }); V.modal = null; V.toast = 'Tag angelernt.'; });
    setTimeout(() => { V.toast = null; render(); }, 3000);
  },
  async tagToggle(d) { const t = S.tags.find((x) => x.id === d.t); await run(() => api.setTagActive(d.t, !t.active)); },
  async tagDel(d) { await run(() => api.delTag(d.t)); },

  csv(d) { V.modal = { type: 'csv', uid: d.u }; render(); },
  csvCopy() {
    const t = $('#csv-t'); t.select();
    try { navigator.clipboard.writeText(t.value).then(() => toast('Kopiert.'), () => toast('Markiert. Bitte mit Strg+C kopieren.')); } catch (e) { toast('Markiert. Bitte mit Strg+C kopieren.'); }
  },

  openAccount() { V.modal = { type: 'account', err: '', ok: '' }; render(); },
  async savePassword() {
    const m = V.modal, a = $('#pw1').value, b = $('#pw2').value;
    if (a.length < 10) { m.err = 'Das Passwort braucht mindestens 10 Zeichen.'; m.ok = ''; return render(); }
    if (a !== b) { m.err = 'Die beiden Passwörter sind nicht gleich.'; m.ok = ''; return render(); }
    try { await api.changePassword(a); m.err = ''; m.ok = 'Passwort geändert.'; } catch (e) { m.err = e.message; m.ok = ''; }
    render();
  },

  async nfcStart() { await nfcStart(); },
  nfcSim(d) { onTag(d.k === '1' ? DEMO_TAG_UID : DEMO_UNKNOWN_UID); },
};

async function logoutLocal() {
  V.session = null; V.boot = 'login'; V.screen = 'home'; V.modal = null; V.done = null; V.err = ''; V.mfa = null; V.pending = null; wipe();
}
async function logout() {
  await api.signOut();
  await logoutLocal();
  render();
}

document.addEventListener('click', (ev) => {
  V.lastAct = Date.now();
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  if (el.hasAttribute('data-self') && ev.target !== el) return;
  const f = ACT[el.dataset.act];
  if (f) f(el.dataset, el);
});
document.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const id = ev.target.id;
  V.lastAct = Date.now();
  if (V.busy) return;
  if (id === 'login-form') {
    const email = $('#em').value, pw = $('#pw').value;
    V.busy = true; V.err = ''; render();
    try { await applyAuth(await api.signIn(email, pw)); } catch (e) { V.err = e.message; }
    V.busy = false; render(); keepAwake();
  } else if (id === 'mfa-form') {
    const code = $('#code').value;
    V.busy = true; V.err = ''; render();
    try { await api.mfaVerify(V.pending.factorId, code); await applyAuth({ state: 'app', session: V.pending.session }); } catch (e) { V.err = e.message; }
    V.busy = false; render();
  } else if (id === 'enroll-form') {
    const code = $('#code').value;
    V.busy = true; V.err = ''; render();
    try { await api.mfaVerify(V.mfa.factorId, code); V.mfa = null; await applyAuth({ state: 'app', session: V.pending.session }); } catch (e) { V.err = e.message; }
    V.busy = false; render();
  } else if (id === 'setup-form') {
    const email = $('#em').value, pw = $('#pw').value;
    V.busy = true; V.err = ''; render();
    try { await api.kiosk.signIn(email, pw); V.device = 'tablet'; V.screen = 'home'; keepAwake(); } catch (e) { V.err = e.message; }
    V.busy = false; render();
  }
});
document.addEventListener('keydown', (ev) => {
  V.lastAct = Date.now();
  if (ev.key === 'Escape' && V.modal) { stopTagScan(); V.modal = null; render(); }
});
document.addEventListener('touchstart', () => { V.lastAct = Date.now(); }, { passive: true });
document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset && el.dataset.set) {
    const k = el.dataset.set;
    let v = el.value;
    if (k === 'business') v = v.trim() || 'Bäckerei Weber';
    else { v = parseFloat(String(v).replace(',', '.')); if (isNaN(v) || v < SETTING_LIMITS[k][0] || v > SETTING_LIMITS[k][1]) { toast('Wert außerhalb des erlaubten Bereichs.'); return; } }
    run(() => api.saveSetting(k, v));
  } else if (el.dataset && el.dataset.person) {
    run(() => api.saveProfile(el.dataset.person, { name: el.value.trim().slice(0, 60) }));
  }
});
window.addEventListener('online', render);
window.addEventListener('offline', render);
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;
  keepAwake();
  if (V.boot === 'app' && !V.modal && !typing()) { try { await reload(); } catch (e) { /* offline */ } render(); }
});

/* ============================== Takt ============================== */
setInterval(() => {
  const now = new Date();
  document.querySelectorAll('[data-live="clock"]').forEach((n) => { n.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()); });
  document.querySelectorAll('[data-live="work"]').forEach((n) => { n.textContent = hm(todayMin(n.dataset.uid, now)); });
  // Am gemeinsamen Tablet endet jede Anmeldung nach kurzer Ruhe
  if (V.session && V.device === 'tablet' && !isDemo && now - V.lastAct > S.settings.idleSec * 1000) logout();
  if (V.session && V.device === 'tablet' && isDemo && now - V.lastAct > Math.max(S.settings.idleSec, 300) * 1000) logout();
}, 1000);
setInterval(async () => {
  if (V.boot !== 'app' || V.modal || V.done || V.toast || V.busy || typing()) return;
  try { await reload(); } catch (e) { /* offline: später wieder */ }
  render();
}, 30000);

/* ============================== Start ============================== */
async function boot() {
  render();
  try {
    await api.init();
    V.device = isDemo ? (window.innerWidth >= 700 ? 'tablet' : 'phone') : ((await api.kiosk.configured()) ? 'tablet' : 'phone');
    await applyAuth(await api.restore());
  } catch (e) {
    V.boot = 'login'; V.err = e.message || 'Der Start hat nicht geklappt.';
  }
  render();
  keepAwake(); autoNfc();
  if (!isDemo && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
}
if (isDemo) window.__bwz = { api, S, V, render };
boot();

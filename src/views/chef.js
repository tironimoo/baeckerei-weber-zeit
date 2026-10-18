import { S } from '../store.js';
import { ABS, auditText, closureOn, entriesOf, flags, mas, monthCredit, monthEntries, netMin, nextClosure, openEntry, pendCount, todayAbs, todayMin, userById, weekCredit, weekMin, weekSoll } from '../calc.js';
import { dec, esc, eur, fmtD, fmtDY, fmtT, hm, initials, mkey, pd, weeksBetween, wstart, pad } from '../util.js';
import { absRow, reqRow, vacCard } from './parts.js';
import { timesView } from './ma.js';
import { api } from '../api/index.js';

export function chefOverview() {
  const now = new Date(), M = mas(), ws = wstart(now), soll = weekSoll(ws) * M.length;
  const wk = M.reduce((s, u) => s + weekMin(u.id, now) + weekCredit(u.id, ws), 0), mk = mkey(now);
  const mm = M.reduce((s, u) => s + monthEntries(u.id, mk).reduce((a, e) => a + netMin(e), 0) + monthCredit(u.id, mk), 0);
  const pend = pendCount(), nx = nextClosure(), cl = closureOn(now);
  const warn = [];
  M.forEach((u) => entriesOf(u.id).slice(0, 20).forEach((e) => flags(e).forEach((f) => warn.push({ u, e, f }))));
  const closureBanner = cl ? `<div class="banner crust"><span><b>Betriebsferien</b> bis ${fmtDY(pd(cl.to))}. Kein Wochensoll.</span></div>`
    : (nx ? `<div class="banner crust"><span>Nächste Betriebsferien: <b>${fmtDY(pd(nx.from))} bis ${fmtDY(pd(nx.to))}</b> (${dec(weeksBetween(nx.from, nx.to))} Wochen)</span><button class="linkbtn" data-act="tab" data-t="settings">Ändern</button></div>` : '');
  const cards = M.length ? M.map((u) => {
    const e = openEntry(u.id), ab = todayAbs(u.id);
    const st = !e ? (ab ? `<span class="chip warn">Heute: ${ABS[ab.type].n}</span>` : '<span class="chip">Nicht im Dienst</span>') : (e.breakStart ? '<span class="chip warn">In Pause</span>' : `<span class="chip good">Im Dienst seit ${fmtT(new Date(e.start))}</span>`);
    return `<div class="card stack" style="gap:12px"><div class="row between"><div class="row"><div class="avatar">${esc(initials(u.name))}</div><div><h3>${esc(u.name || u.email)}</h3><div class="muted small">Heute ${hm(todayMin(u.id, now))} Std.</div></div></div>${st}</div>` +
      `<button class="btn btn-dark" data-act="actAs" data-u="${u.id}">Als ${esc((u.name || 'Mitarbeiterin').split(' ')[0])} ansehen und stempeln</button>` +
      '<p class="muted small">Falls das Handy nicht griffbereit ist. Einträge werden als „Chefin“ vermerkt.</p></div>';
  }).join('') : '<div class="card"><h3>Noch keine Mitarbeiterin</h3><p class="muted small" style="margin-top:6px">Lege unter Supabase, Authentication, Users ein Konto an. Danach erscheint die Person hier und du gibst ihr unter Einstellungen einen Namen.</p></div>';
  return `<div class="stack">${closureBanner}<div class="stats">` +
    `<div class="stat"><div class="eyebrow">Diese Woche</div><div class="v num">${hm(wk)}</div><div class="s">Soll ${hm(soll)} Std.</div></div>` +
    `<div class="stat"><div class="eyebrow">Dieser Monat</div><div class="v num">${hm(mm)}</div><div class="s">ca. ${eur(mm / 60 * S.settings.wage)} brutto</div></div>` +
    `<div class="stat"><div class="eyebrow">Offene Anträge</div><div class="v num">${pend}</div><div class="s">${pend ? 'warten auf dich' : 'alles erledigt'}</div></div></div>` +
    `<div class="grid2">${cards}<div class="card"><h3>Hinweise</h3>` +
    (warn.length ? `<div class="list" style="margin-top:10px">${warn.slice(0, 5).map((w) => `<div class="item"><div style="min-width:0"><div class="t">${esc(w.u.name)} · ${fmtD(new Date(w.e.start))}</div><div class="chips" style="margin-top:2px"><span class="chip ${w.f.c}">${w.f.t}</span></div></div><div class="r"><button class="linkbtn" data-act="openEdit" data-e="${w.e.id}">Korrigieren</button></div></div>`).join('')}</div>` : '<p class="empty">Keine Auffälligkeiten.</p>') + '</div></div></div>';
}

export const chefTimes = () => `<div class="stack">${mas().map((u) => `<div><h2 style="margin-bottom:12px">${esc(u.name || u.email)}</h2>${timesView(u.id, 'chef')}</div>`).join('') || '<div class="card"><p class="empty">Noch keine Mitarbeiterin angelegt.</p></div>'}</div>`;

export function chefRequests() {
  const p = S.requests.filter((r) => r.status === 'pending'), d = S.requests.filter((r) => r.status !== 'pending').slice(0, 5);
  const ap = S.absences.filter((a) => a.status === 'pending');
  return `<div class="stack"><div class="card"><h3>Fehlzeiten zur Bestätigung</h3>${ap.length ? `<div class="list" style="margin-top:10px">${ap.map(absRow).join('')}</div>` : '<p class="empty">Keine offenen Fehlzeiten.</p>'}</div>` +
    `<div class="card"><h3>Zeitkorrekturen und Nachträge</h3>${p.length ? `<div class="list" style="margin-top:10px">${p.map((r) => reqRow(r, true)).join('')}</div>` : '<p class="empty">Keine offenen Anträge.</p>'}</div>` +
    (d.length ? `<div class="card"><h3>Zuletzt entschieden</h3><div class="list" style="margin-top:10px">${d.map((r) => `<div class="item"><div><div class="t">${esc(userById(r.userId).name)} · ${fmtD(pd(r.date))}</div><div class="s">${esc(r.start)}–${esc(r.end)}</div></div><div class="r"><span class="chip ${r.status === 'ok' ? 'good' : 'bad'}">${r.status === 'ok' ? 'Angenommen' : 'Abgelehnt'}</span></div></div>`).join('')}</div></div>` : '') + '</div>';
}

export function chefTags() {
  return `<div class="stack"><div class="card"><div class="row between"><div><h3>NFC-Tags</h3><p class="muted small" style="margin-top:4px">Ein Tag stempelt nur am Geschäftstablet. Verlorene Tags sperrst du hier sofort.</p></div><button class="btn btn-primary btn-sm" data-act="openTag">Neuen Tag anlernen</button></div>` +
    `<div class="list" style="margin-top:10px">${S.tags.length ? S.tags.map((t) => `<div class="item"><div style="min-width:0"><div class="t">${esc(t.label)}</div><div class="s">${esc(userById(t.userId).name)}</div><div class="s">${t.lastUsed ? 'Zuletzt benutzt ' + fmtD(new Date(t.lastUsed)) + ' ' + fmtT(new Date(t.lastUsed)) : 'Noch nicht benutzt'}</div></div><div class="r"><span class="chip ${t.active ? 'good' : 'bad'}">${t.active ? 'Aktiv' : 'Gesperrt'}</span><button class="linkbtn" data-act="tagToggle" data-t="${t.id}">${t.active ? 'Sperren' : 'Entsperren'}</button><button class="linkbtn" data-act="tagDel" data-t="${t.id}">Löschen</button></div></div>`).join('') : '<p class="empty">Noch kein Tag angelernt.</p>'}</div></div>` +
    '<div class="hint"><b>Wichtig:</b> Ein Tag lässt sich kopieren und ist deshalb kein Passwort. Er kann nur ein- und ausstempeln, nie Zeiten ändern oder Daten einsehen. Gespeichert wird nur ein Fingerabdruck (Hash) der Tag-Nummer. Jede Tag-Buchung steht im Protokoll.</div></div>';
}

export function chefSettings() {
  const s = S.settings, m = mas()[0];
  const people = S.users.filter((u) => u.role === 'ma');
  const lock = (api.mode === 'demo');
  return '<div class="grid2"><div class="card form"><h3>Arbeitszeit und Lohn</h3>' +
    `<label class="f">Name des Betriebs<input type="text" data-set="business" value="${esc(s.business)}" maxlength="40"></label>` +
    `<div class="form2"><label class="f">Stunden pro Woche<input type="number" data-set="weeklyHours" value="${s.weeklyHours}" min="1" max="40" step="0.5"></label><label class="f">Arbeitstage pro Woche<input type="number" data-set="workDays" value="${s.workDays}" min="1" max="6"></label></div>` +
    `<div class="form2"><label class="f">Stundenlohn (brutto, €)<input type="number" data-set="wage" value="${s.wage}" min="0" step="0.05"></label><label class="f">Urlaubstage pro Jahr<input type="number" data-set="vacationDays" value="${s.vacationDays}" min="0" max="60"></label></div>` +
    `<label class="f">Anmeldung am Geschäftstablet endet nach (Sekunden Ruhe)<input type="number" data-set="idleSec" value="${s.idleSec}" min="15" max="600" step="15"></label></div>` +
    '<div class="card stack"><h3>Datenschutz</h3>' +
    '<p class="small">Gespeichert werden nur: Name, E-Mail, Beginn, Ende, Pause, Fehlzeiten, Quelle der Buchung und das Änderungsprotokoll. Kein Standort, kein Foto, keine Auswertung durch Dritte.</p>' +
    '<p class="small">Bei Krankmeldungen steht nur „Krank“, <b>nie eine Diagnose</b>. Gesundheitsdaten sind besonders geschützt.</p>' +
    `<p class="small">Zeiten werden <b>${s.retentionYears} Jahre</b> aufbewahrt (gesetzliche Pflicht) und danach automatisch gelöscht, sobald die nächtliche Löschung in Supabase aktiviert ist.</p>` +
    '<div class="chips"><span class="chip good">Änderungen nur mit Authenticator-Code</span><span class="chip good">Änderungen protokolliert</span></div></div>' +
    '<div class="card stack" style="grid-column:1/-1"><div><h3>Personen</h3><p class="muted small" style="margin-top:4px">Neue Konten legst du in Supabase unter Authentication, Users an. Hier gibst du ihnen einen Namen.</p></div>' +
    `<div class="list">${people.length ? people.map((u) => `<div class="item"><div style="min-width:0"><label class="f" style="margin:0">Name<input type="text" data-person="${u.id}" value="${esc(u.name)}" maxlength="60" placeholder="Vor- und Nachname"></label><div class="s" style="margin-top:4px">${esc(u.email)}</div></div><div class="r"><span class="chip ${u.active ? 'good' : 'bad'}">${u.active ? 'Aktiv' : 'Deaktiviert'}</span><button class="linkbtn" data-act="personToggle" data-p="${u.id}">${u.active ? 'Deaktivieren' : 'Aktivieren'}</button></div></div>`).join('') : '<p class="empty">Noch keine Mitarbeiterin angelegt.</p>'}</div></div>` +
    '<div class="card stack" style="grid-column:1/-1"><div><h3>Betriebsferien</h3><p class="muted small" style="margin-top:4px">In diesen Wochen gibt es kein Wochensoll. Beim Stempeln erscheint ein Hinweis.</p></div>' +
    (S.closures.length ? `<div class="list">${S.closures.slice().sort((a, b) => (a.from < b.from ? -1 : 1)).map((c) => `<div class="item"><div style="min-width:0"><div class="t">${esc(c.label)}</div><div class="s num">${fmtDY(pd(c.from))} bis ${fmtDY(pd(c.to))} · ${dec(weeksBetween(c.from, c.to))} Wochen</div></div><div class="r"><button class="linkbtn" data-act="closureDel" data-c="${c.id}">Entfernen</button></div></div>`).join('')}</div>` : '<p class="empty">Keine Betriebsferien eingetragen.</p>') +
    '<div class="form2"><label class="f">Von<input type="date" id="c-from"></label><label class="f">Bis<input type="date" id="c-to"></label></div>' +
    '<label class="f">Bezeichnung<input type="text" id="c-label" value="Betriebsferien" maxlength="50"></label><div><button class="btn btn-ghost" data-act="closureAdd">Betriebsferien hinzufügen</button></div></div>' +
    (m ? `<div style="grid-column:1/-1">${vacCard(m.id)}</div>` : '') +
    '<div class="card stack" style="grid-column:1/-1"><div><h3>Dieses Gerät</h3><p class="muted small" style="margin-top:4px">Als Geschäftstablet eingerichtet stempeln Mitarbeiterinnen hier mit dem NFC-Tag. Das Tablet-Konto kann nur stempeln, sonst nichts.</p></div>' +
    `<div class="row">${lock ? '<span class="chip">Im Übungsmodus nicht nötig</span>' : '<button class="btn btn-ghost" data-act="setupKiosk">Als Geschäftstablet einrichten</button><button class="btn btn-ghost" data-act="endKiosk">Tablet-Modus beenden</button>'}</div></div></div>`;
}

export function chefAudit() {
  const rows = S.audit.map((r) => ({ r, t: auditText(r) }));
  return '<div class="card"><h3>Änderungsprotokoll</h3><p class="muted small" style="margin:4px 0 8px">Nichts wird überschrieben. Jede Buchung und Korrektur steht hier mit Zeitpunkt und Urheber. Angezeigt werden die letzten 150 Einträge.</p><div class="list">' +
    (rows.length ? rows.map(({ r, t }) => { const d = new Date(r.ts); return `<div class="item"><div style="min-width:0"><div class="t">${esc(t.a)}</div><div class="s">${esc(t.d)}</div></div><div class="r"><span class="s num">${fmtD(d)} ${fmtT(d)}</span><span class="chip">${esc(r.actorName || 'System')}</span></div></div>`; }).join('') : '<p class="empty">Noch keine Einträge.</p>') + '</div></div>';
}

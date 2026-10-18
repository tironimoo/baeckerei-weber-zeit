import { S, V } from '../store.js';
import { ABS, absDates, flags, mas, monthEntries, netMin, userById } from '../calc.js';
import { ICONS, dkey, esc, fmtT, greet, hm } from '../util.js';
import { api } from '../api/index.js';

function entryModal(m) {
  const e = m.eid ? S.entries.find((x) => x.id === m.eid) : null, mode = m.mode;
  const u = e ? e.userId : m.uid, s = e ? new Date(e.start) : new Date(), en = e && e.end ? new Date(e.end) : null;
  const title = mode === 'edit' ? (e ? 'Eintrag bearbeiten' : 'Zeit nachtragen') : (e ? 'Korrektur beantragen' : 'Zeit nachtragen');
  return `<div class="scrim" data-act="closeModal" data-self><div class="sheet" role="dialog" aria-modal="true" aria-label="${title}"><h2>${title}</h2>` +
    `<p class="muted small">${mode === 'edit' ? 'Die Änderung wird sofort gespeichert und im Protokoll vermerkt.' : 'Die Chefin muss die Änderung bestätigen.'}</p>` +
    `<div class="form"><label class="f">Datum<input type="date" id="f-date" value="${dkey(s)}"${e ? ' disabled' : ''}></label>` +
    `<div class="form2"><label class="f">Beginn<input type="time" id="f-start" value="${fmtT(s)}"></label><label class="f">Ende<input type="time" id="f-end" value="${en ? fmtT(en) : ''}"></label></div>` +
    `<label class="f">Pause (Minuten)<input type="number" id="f-break" min="0" max="180" step="5" value="${(e && e.breakMin) || 0}"></label>` +
    '<label class="f">Grund<textarea id="f-reason" maxlength="110" placeholder="Zum Beispiel: Ausstempeln vergessen"></textarea></label>' +
    (m.err ? `<p class="err" role="alert">${esc(m.err)}</p>` : '') +
    `<div class="row" style="justify-content:flex-end"><button class="btn btn-ghost" data-act="closeModal">Abbrechen</button><button class="btn btn-primary" data-act="submitEntry">${mode === 'edit' ? 'Speichern' : 'Beantragen'}</button></div></div>` +
    `<input type="hidden" id="f-user" value="${esc(u)}"></div></div>`;
}

function absModal(m) {
  const today = dkey(new Date()), ty = m.ty || 'krank';
  const title = m.direct ? 'Fehlzeit eintragen' : (ty === 'krank' ? 'Krank melden' : 'Urlaub beantragen');
  return `<div class="scrim" data-act="closeModal" data-self><div class="sheet" role="dialog" aria-modal="true" aria-label="${title}"><h2>${title}</h2>` +
    `<p class="muted small">${m.direct ? 'Wird sofort gespeichert und im Protokoll vermerkt.' : 'Die Chefin bestätigt die Fehlzeit.'}</p>` +
    `<div class="form"><label class="f">Art<select id="a-type"><option value="krank"${ty === 'krank' ? ' selected' : ''}>Krank</option><option value="urlaub"${ty === 'urlaub' ? ' selected' : ''}>Urlaub</option><option value="sonst"${ty === 'sonst' ? ' selected' : ''}>Frei (unbezahlt)</option></select></label>` +
    `<div class="form2"><label class="f">Von<input type="date" id="a-from" value="${today}"></label><label class="f">Bis (einschließlich)<input type="date" id="a-to" value="${today}"></label></div>` +
    '<label class="f">Notiz (optional)<textarea id="a-note" maxlength="120" placeholder="Zum Beispiel: Arzttermin"></textarea></label>' +
    '<div class="hint"><b>Bitte keine Diagnose eintragen.</b> Es genügt „Krank“. Ab dem 4. Kalendertag ist eine Krankschreibung (AU) nötig.</div>' +
    (m.err ? `<p class="err" role="alert">${esc(m.err)}</p>` : '') +
    `<div class="row" style="justify-content:flex-end"><button class="btn btn-ghost" data-act="closeModal">Abbrechen</button><button class="btn btn-primary" data-act="submitAbs">${m.direct ? 'Speichern' : (ty === 'krank' ? 'Melden' : 'Beantragen')}</button></div></div>` +
    `<input type="hidden" id="a-user" value="${esc(m.uid)}"></div></div>`;
}

function tagModal(m) {
  const demo = api.mode === 'demo', nfc = 'NDEFReader' in window;
  return '<div class="scrim" data-act="closeModal" data-self><div class="sheet" role="dialog" aria-modal="true" aria-label="Neuen Tag anlernen"><h2>Neuen Tag anlernen</h2>' +
    `<div class="nfc" style="width:150px;height:150px;margin:0 auto"><span class="ring"></span><span class="ring"></span><div class="core" style="width:76px;height:76px">${ICONS.nfc}</div></div>` +
    `<p class="muted small" style="text-align:center">${m.uid ? '<b>Tag erkannt.</b> Gib ihm einen Namen und wähle die Person.' : (nfc ? 'Tag an die Rückseite des Tablets halten.' : 'Dieses Gerät kann NFC im Browser nicht lesen. Trage die Tag-Nummer von Hand ein oder nutze ein Android-Tablet mit Chrome.')}</p>` +
    '<div class="form">' +
    (m.uid ? '' : '<label class="f">Tag-Nummer (nur wenn nicht gescannt)<input type="text" id="t-uid" placeholder="04:A2:19:7C:3B:5E:80" autocapitalize="characters" autocomplete="off"></label>') +
    '<label class="f">Bezeichnung<input type="text" id="t-label" value="Neuer Tag" maxlength="30"></label>' +
    `<label class="f">Gehört zu<select id="t-user">${mas().map((u) => `<option value="${u.id}">${esc(u.name || u.email)}</option>`).join('')}</select></label>` +
    (m.err ? `<p class="err" role="alert">${esc(m.err)}</p>` : '') +
    `<div class="row" style="justify-content:flex-end"><button class="btn btn-ghost" data-act="closeModal">Abbrechen</button>${demo && !m.uid ? '<button class="btn btn-ghost" data-act="tagSim">Demo-Tag erkennen</button>' : ''}<button class="btn btn-primary" data-act="tagSave">Speichern</button></div></div></div></div>`;
}

export function csvText(u, key) {
  const rows = ['Datum;Beginn;Ende;Pause (Min);Netto (Std);Quelle;Hinweis'];
  monthEntries(u, key).slice().reverse().forEach((e) => {
    const s = new Date(e.start), en = e.end ? new Date(e.end) : null;
    rows.push([dkey(s), fmtT(s), en ? fmtT(en) : '', e.breakMin || 0, (netMin(e) / 60).toFixed(2).replace('.', ','), e.source, flags(e).map((f) => f.t).join(' / ')].join(';'));
  });
  const tot = monthEntries(u, key).reduce((s, e) => s + netMin(e), 0);
  rows.push(';;;Summe;' + (tot / 60).toFixed(2).replace('.', ',') + ';;');
  return rows.join('\n');
}
function csvModal(m) {
  return `<div class="scrim" data-act="closeModal" data-self><div class="sheet" role="dialog" aria-modal="true" aria-label="Monatsliste"><h2>Monatsliste ${esc(userById(m.uid).name)}</h2>` +
    '<p class="muted small">Zum Abheften oder für den Steuerberater. In Excel einfügen: Daten, Text in Spalten, Trennzeichen Semikolon.</p>' +
    `<textarea class="csv" id="csv-t" readonly>${esc(csvText(m.uid, V.month))}</textarea>` +
    '<div class="row" style="justify-content:flex-end"><button class="btn btn-ghost" data-act="closeModal">Schließen</button><button class="btn btn-primary" data-act="csvCopy">Kopieren</button></div></div></div>';
}

function accountModal(m) {
  const me = V.session || {};
  return `<div class="scrim" data-act="closeModal" data-self><div class="sheet" role="dialog" aria-modal="true" aria-label="Konto"><h2>Mein Konto</h2><p class="muted small">${esc(me.name || '')} · ${esc(me.email || '')}</p>` +
    '<div class="form"><label class="f">Neues Passwort (mindestens 10 Zeichen)<input type="password" id="pw1" autocomplete="new-password"></label>' +
    '<label class="f">Passwort wiederholen<input type="password" id="pw2" autocomplete="new-password"></label>' +
    (m.err ? `<p class="err" role="alert">${esc(m.err)}</p>` : '') + (m.ok ? `<p class="small" style="color:var(--good);font-weight:600">${esc(m.ok)}</p>` : '') +
    '<div class="row" style="justify-content:flex-end"><button class="btn btn-ghost" data-act="closeModal">Schließen</button><button class="btn btn-primary" data-act="savePassword">Passwort ändern</button></div></div></div></div>';
}

export function modalHtml() {
  const m = V.modal;
  if (!m) return '';
  if (m.type === 'entry') return entryModal(m);
  if (m.type === 'abs') return absModal(m);
  if (m.type === 'tag') return tagModal(m);
  if (m.type === 'csv') return csvModal(m);
  if (m.type === 'account') return accountModal(m);
  return '';
}

/** Rückmeldung nach dem Stempeln (Tablet: schließt sich selbst, Handy: bleibt bis "Fertig"). */
export function overlayHtml() {
  const d = V.done;
  if (!d) return '';
  const kiosk = !V.session;
  if (d.type === 'in') return `<div class="scrim" data-act="closeDone" data-self><div class="sheet big"><div class="tick">${ICONS.check}</div><h1>${greet()}, ${esc(d.name)}!</h1><p>Eingestempelt um <b class="num">${fmtT(new Date(d.start))} Uhr</b>. Schönen Arbeitstag!</p><button class="btn btn-ghost" data-act="closeDone">Fertig</button></div></div>`;
  if (d.type === 'out') {
    return `<div class="scrim" data-act="${kiosk ? 'closeDone' : 'noop'}" data-self><div class="sheet big"><div class="tick">${ICONS.check}</div><h1>Schönen Feierabend, ${esc(d.name)}!</h1><p>Ausgestempelt um <b class="num">${fmtT(new Date(d.end))} Uhr</b>. Heute gearbeitet: <b class="num">${hm(d.net_min)} Std.</b></p>` +
      `<div><p class="small muted" style="margin-bottom:8px">Wie lang war deine Pause?</p><div class="break-chips">${[0, 15, 30, 45, 60].map((b) => `<button data-act="setBreak" data-e="${d.entry_id}" data-m="${b}" class="${d.break_min === b ? 'on' : ''}">${b} Min.</button>`).join('')}</div></div>` +
      '<button class="btn btn-dark" data-act="closeDone">Fertig</button></div></div>';
  }
  const cfg = {
    dup: ['warn', 'Gerade erst gestempelt', 'Bitte warte eine Minute, bevor du erneut stempelst.', ICONS.check],
    unknown: ['bad', 'Tag nicht bekannt', 'Dieser Tag ist nicht angelegt. Bitte kurz bei der Chefin melden.', ICONS.cross],
    blocked: ['bad', 'Stempeln nicht möglich', 'Dieser Tag ist gesperrt oder die Person nicht aktiv. Bitte bei der Chefin melden.', ICONS.cross],
    stale: ['warn', 'Ausstempeln fehlt', 'Der letzte Eintrag wurde nicht beendet. Bitte bei der Chefin melden.', ICONS.cross],
    error: ['bad', 'Das hat nicht geklappt', d.message || 'Bitte später noch einmal versuchen.', ICONS.cross],
  }[d.type];
  if (!cfg) return '';
  return `<div class="scrim" data-act="closeDone" data-self><div class="sheet big"><div class="tick ${cfg[0]}">${cfg[3]}</div><h1>${cfg[1]}</h1><p class="muted">${esc(cfg[2])}</p><button class="btn btn-ghost" data-act="closeDone">Okay</button></div></div>`;
}
export { ABS, absDates };

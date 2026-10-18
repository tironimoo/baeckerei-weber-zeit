import { S, V } from '../store.js';
import { WEEKDAYS, MONTHS, ICONS, esc } from '../util.js';
import { api } from '../api/index.js';
import { brand } from './parts.js';

const hasNfc = () => 'NDEFReader' in window;

export function loginView() {
  const demo = api.mode === 'demo';
  return `<section class="login"><div class="stack" style="gap:14px">${brand()}<h1>Anmelden</h1></div>` +
    '<form class="form" id="login-form" autocomplete="on">' +
    '<label class="f">E-Mail<input type="email" id="em" name="username" autocomplete="username" inputmode="email" autocapitalize="off" required></label>' +
    '<label class="f">Passwort<input type="password" id="pw" name="password" autocomplete="current-password" required></label>' +
    (V.err ? `<p class="err" role="alert">${esc(V.err)}</p>` : '') +
    `<button class="btn btn-primary" type="submit"${V.busy ? ' disabled' : ''}>${V.busy ? 'Einen Moment …' : 'Anmelden'}</button></form>` +
    (demo ? '<div class="hint"><b>Übungsmodus:</b> Hier liegen keine echten Daten, alles bleibt nur in diesem Browser. Mitarbeiterin <b>lena@demo</b> / <b>backen</b>. Chefin <b>chefin@demo</b> / <b>chefin</b>, Code <b>123456</b>.</div>' : '') +
    '<div class="row" style="justify-content:space-between">' +
    (V.device === 'tablet' ? '<button class="linkbtn" data-act="goHome">← Zurück zum Stempeln</button>' : (demo ? '' : '<button class="linkbtn" data-act="setupKiosk">Als Geschäftstablet einrichten</button>')) +
    (demo ? '' : '<a class="linkbtn" href="?check">Systemprüfung</a>') +
    '</div></section>';
}

export function mfaView() {
  return `<section class="login"><div class="stack" style="gap:14px">${brand()}<h1>Zweiter Schritt</h1><p class="muted">Öffne deine Authenticator-App und gib den 6-stelligen Code ein.</p></div>` +
    '<form class="form" id="mfa-form" autocomplete="off"><label class="f">Code<input type="text" id="code" inputmode="numeric" pattern="[0-9 ]*" maxlength="7" autocomplete="one-time-code" placeholder="123456" required></label>' +
    (V.err ? `<p class="err" role="alert">${esc(V.err)}</p>` : '') +
    `<button class="btn btn-primary" type="submit"${V.busy ? ' disabled' : ''}>Bestätigen</button></form>` +
    '<div><button class="linkbtn" data-act="cancelLogin">Abbrechen und abmelden</button></div></section>';
}

export function enrollView() {
  const m = V.mfa || {};
  const grouped = String(m.secret || '').replace(/(.{4})/g, '$1 ').trim();
  return `<section class="login"><div class="stack" style="gap:14px">${brand()}<h1>Authenticator einrichten</h1><p class="muted">Die Chefin meldet sich mit einem zweiten Faktor an. Das schützt die Daten, auch wenn ein Passwort in falsche Hände gerät.</p></div>` +
    '<ol class="steps small"><li><div><b>App installieren,</b> zum Beispiel Google Authenticator, Microsoft Authenticator oder Aegis.</div></li><li><div><b>QR-Code scannen.</b> Im Handy-Browser: den Schlüssel unten abtippen.</div></li><li><div><b>Den 6-stelligen Code eingeben.</b></div></li></ol>' +
    `<div class="card" style="justify-items:center;text-align:center">${m.qr ? `<img src="${esc(m.qr)}" alt="QR-Code zum Einrichten der Authenticator-App" width="200" height="200" style="background:#fff;border-radius:12px;padding:8px">` : ''}` +
    `<div class="small muted">Schlüssel zum Abtippen</div><code class="secret">${esc(grouped)}</code></div>` +
    '<form class="form" id="enroll-form" autocomplete="off"><label class="f">Code aus der App<input type="text" id="code" inputmode="numeric" pattern="[0-9 ]*" maxlength="7" autocomplete="one-time-code" placeholder="123456" required></label>' +
    (V.err ? `<p class="err" role="alert">${esc(V.err)}</p>` : '') +
    `<button class="btn btn-primary" type="submit"${V.busy ? ' disabled' : ''}>Einrichten</button></form>` +
    '<div><button class="linkbtn" data-act="cancelLogin">Abbrechen und abmelden</button></div></section>';
}

export function setupView() {
  return `<section class="login"><div class="stack" style="gap:14px">${brand()}<h1>Geschäftstablet einrichten</h1><p class="muted">Melde das Tablet einmal mit seinem Tablet-Konto an. Danach stempeln Mitarbeiterinnen hier per NFC-Tag, ohne Anmeldung. Das Tablet-Konto kann sonst nichts.</p></div>` +
    '<form class="form" id="setup-form" autocomplete="off"><label class="f">E-Mail des Tablet-Kontos<input type="email" id="em" autocapitalize="off" required></label>' +
    '<label class="f">Passwort<input type="password" id="pw" autocomplete="off" required></label>' +
    (V.err ? `<p class="err" role="alert">${esc(V.err)}</p>` : '') +
    `<button class="btn btn-primary" type="submit"${V.busy ? ' disabled' : ''}>Einrichten</button></form>` +
    '<div><button class="linkbtn" data-act="goHome">Abbrechen</button></div></section>';
}

export function kioskView() {
  const now = new Date(), demo = api.mode === 'demo';
  const status = V.nfcActive ? '<span class="chip good">NFC bereit</span>' : (hasNfc() ? '<button class="btn btn-ghost" data-act="nfcStart">NFC aktivieren</button>' : '<span class="chip warn">NFC nur mit Chrome auf Android</span>');
  return '<section class="kiosk"><div class="stack" style="gap:6px;justify-items:center">' + brand() + '</div>' +
    `<div><div class="eyebrow">${(now.getHours() < 11 ? 'Guten Morgen' : now.getHours() < 17 ? 'Guten Tag' : 'Guten Abend')}</div><div class="clock num" data-live="clock">${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}</div>` +
    `<p class="muted" style="margin-top:6px">${WEEKDAYS[now.getDay()]}, ${now.getDate()}. ${MONTHS[now.getMonth()]} ${now.getFullYear()}</p></div>` +
    `<div class="nfc"><span class="ring"></span><span class="ring"></span><span class="ring"></span><div class="core">${ICONS.nfc}</div></div>` +
    '<div><h2>Tag an das Tablet halten</h2><p class="muted" style="margin-top:6px">Morgens zum Einstempeln, nachmittags zum Ausstempeln.</p></div>' +
    `<div class="row" style="justify-content:center">${status}<button class="btn btn-dark" data-act="goLogin">Anmelden</button></div>` +
    (V.err ? `<p class="err" role="alert">${esc(V.err)}</p>` : '') +
    (demo ? '<div class="simbox"><div class="eyebrow">Übungsmodus: NFC simulieren</div><p class="small muted">Echtes NFC-Lesen geht nur mit Chrome auf einem Android-Tablet. Hier kannst du das Auflegen nachstellen.</p><div class="row"><button class="btn btn-sm btn-primary" data-act="nfcSim" data-k="1">Tag von Lena auflegen</button><button class="btn btn-sm btn-ghost" data-act="nfcSim" data-k="0">Unbekannten Tag auflegen</button></div></div>' : '') +
    '</section>';
}

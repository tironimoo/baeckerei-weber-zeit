import { V } from '../store.js';
import { esc } from '../util.js';
import { brand } from './parts.js';

export function checkView() {
  const items = V.check || [];
  const bad = items.some((i) => i.state === 'bad');
  const sum = V.checking ? '<span class="chip">Prüfe …</span>' : (bad ? '<span class="chip bad">Etwas fehlt</span>' : '<span class="chip good">Alles in Ordnung</span>');
  return `<section class="login"><div class="stack" style="gap:14px">${brand()}<h1>Systemprüfung</h1><p class="muted">Prüft, ob Supabase so eingerichtet ist wie vorgesehen. Dabei wird nichts geändert und niemand angemeldet.</p>${sum}</div>` +
    `<div class="card" style="gap:0">${items.map((i) => `<div class="item" style="grid-template-columns:auto minmax(0,1fr)"><span class="chip ${i.state === 'ok' ? 'good' : i.state === 'bad' ? 'bad' : 'warn'}" style="align-self:start">${i.state === 'ok' ? 'OK' : i.state === 'bad' ? 'Fehler' : 'Hinweis'}</span><div><div class="t">${esc(i.name)}</div><div class="s">${esc(i.hint)}</div></div></div>`).join('') || '<p class="empty">Noch nicht geprüft.</p>'}</div>` +
    `<div class="row"><button class="btn btn-primary" data-act="runCheck"${V.checking ? ' disabled' : ''}>Erneut prüfen</button><a class="linkbtn" href="./">Zur App</a></div>` +
    `<p class="small muted">Version ${esc(typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev')}</p></section>`;
}

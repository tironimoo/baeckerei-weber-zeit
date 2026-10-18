import { S, V } from '../store.js';
import { pendCount, userById } from '../calc.js';
import { esc, initials } from '../util.js';
import { isChef, viewer } from '../session.js';
import { api } from '../api/index.js';
import { brand } from './parts.js';
import { todayView, timesView } from './ma.js';
import { chefAudit, chefOverview, chefRequests, chefSettings, chefTags, chefTimes } from './chef.js';

export function demoBar() {
  if (api.mode !== 'demo') return '';
  return '<div class="demo"><b>Übungsmodus</b><span>Ansicht</span><span class="pill-toggle">' +
    `<button data-act="device" data-d="phone" class="${V.device === 'phone' ? 'on' : ''}">Handy</button><button data-act="device" data-d="tablet" class="${V.device === 'tablet' ? 'on' : ''}">Tablet</button></span>` +
    '<button class="linkbtn" data-act="reset" style="font-size:12px">Zurücksetzen</button></div>';
}

export function appView() {
  const vw = viewer(), chef = isChef(), s = V.session;
  const acting = vw.acting;
  const tabs = (chef && !acting) ? [['overview', 'Übersicht'], ['times', 'Zeiten'], ['requests', 'Anträge'], ['tags', 'NFC-Tags'], ['settings', 'Einstellungen'], ['audit', 'Protokoll']] : [['today', 'Heute'], ['times', 'Zeiten']];
  const pend = pendCount();
  const myName = s.name || (chef ? 'Chefin' : 'Mitarbeiterin');
  let h = `<header class="top">${brand()}<div class="who"><div class="who-t"><button class="linkbtn namebtn" data-act="openAccount">${esc(myName)}</button><button class="linkbtn" data-act="logout" style="padding:0;font-size:13px">Abmelden</button></div><div class="avatar">${esc(initials(myName))}</div></div></header><div class="stripe"></div>`;
  if (!navigator.onLine) h += '<div class="banner warn"><span>Keine Internetverbindung. Stempeln geht erst wieder, wenn du online bist.</span></div>';
  if (acting) h += `<div class="banner crust"><span>Die Chefin stempelt für <b>${esc(userById(vw.uid).name)}</b>. Einträge werden als „Chefin“ vermerkt.</span><button class="linkbtn" data-act="stopActing">Zurück zur Chefin</button></div>`;
  h += '<nav class="seg" aria-label="Bereiche">' + tabs.map((t) => `<button data-act="tab" data-t="${t[0]}" class="${V.tab === t[0] ? 'on' : ''}">${t[1]}${t[0] === 'requests' && pend ? `<span class="badge">${pend}</span>` : ''}</button>`).join('') + '</nav>';
  if (!chef || acting) h += V.tab === 'times' ? timesView(vw.uid, 'ma') : todayView(vw.uid);
  else h += ({ overview: chefOverview, times: chefTimes, requests: chefRequests, tags: chefTags, settings: chefSettings, audit: chefAudit }[V.tab] || chefOverview)();
  return h;
}

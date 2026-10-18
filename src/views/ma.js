import { S, V } from '../store.js';
import { ABS, closureOn, monthCredit, monthEntries, netMin, nextClosure, openEntry, staleEntry, todayAbs, todayMin, userById, inRange } from '../calc.js';
import { dkey, eur, esc, fmtDay, fmtDY, fmtT, greet, hm, pd, sod, weeksBetween, dec } from '../util.js';
import { isChef, viewer } from '../session.js';
import { absCard, absRow, entryRow, groupWeeks, monthNav, reqRow, vacCard, weekCard } from './parts.js';

export function todayView(u) {
  const now = new Date(), e = openEntry(u), stale = staleEntry(u), name = (userById(u).name || '').split(' ')[0] || 'du', ab = todayAbs(u), cl = closureOn(now), nx = nextClosure();
  const state = !e ? 'off' : (e.breakStart ? 'break' : 'on');
  const chip = state === 'off' ? (ab ? `<span class="chip warn">Heute: ${ABS[ab.type].n}</span>` : '<span class="chip">Nicht eingestempelt</span>')
    : state === 'on' ? `<span class="chip good">Im Dienst seit ${fmtT(new Date(e.start))}</span>` : `<span class="chip warn">In Pause seit ${fmtT(new Date(e.breakStart))}</span>`;
  const acts = state === 'off' ? '<button class="btn btn-primary btn-big" data-act="stamp">Kommen</button>'
    : state === 'on' ? '<button class="btn btn-dark btn-big" data-act="stamp">Gehen</button><button class="btn btn-ghost" data-act="pause">Pause starten</button>'
      : '<button class="btn btn-primary btn-big" data-act="pause">Pause beenden</button><button class="btn btn-ghost" data-act="stamp">Gehen</button>';
  const a = sod(now), b = new Date(a); b.setDate(b.getDate() + 1);
  const td = S.entries.filter((x) => x.userId === u && inRange(x, a, b)).sort((p, q) => new Date(q.start) - new Date(p.start));
  const direct = isChef(), vw = viewer(), k = dkey(now);
  const up = S.absences.filter((x) => x.userId === u && x.status !== 'no' && x.to >= k).sort((p, q) => (p.from < q.from ? -1 : 1)).slice(0, 3);
  return (stale ? `<div class="banner warn"><span>Am <b>${fmtDay(new Date(stale.start))}</b> fehlt das Ende. Bitte nachtragen.</span><button class="linkbtn" data-act="${vw.acting ? 'openEdit' : 'openReq'}" data-e="${stale.id}">Ende nachtragen</button></div>` : '') +
    (cl ? `<div class="banner crust"><span><b>Betriebsferien</b> bis ${fmtDY(pd(cl.to))}. Stempeln ist nicht nötig.</span></div>` : '') +
    `<div class="stack"><div><div class="eyebrow">${greet()}</div><h1>${esc(name)}</h1></div>` +
    `<div class="grid2"><div class="card status">${chip}<div><div class="timer num" data-live="work" data-uid="${u}">${hm(todayMin(u, now))}</div><div class="muted small">Arbeitszeit heute, ohne Pause</div></div><div class="actions">${acts}</div></div>` +
    weekCard(u) + '</div>' +
    `<div class="card"><div class="row between"><div><h3>Fehlzeiten und Ferien</h3>${nx ? `<p class="muted small" style="margin-top:4px">Nächste Betriebsferien: ${fmtDY(pd(nx.from))} bis ${fmtDY(pd(nx.to))} (${dec(weeksBetween(nx.from, nx.to))} Wochen)</p>` : ''}</div>` +
    `<div class="row">${direct ? `<button class="btn btn-ghost btn-sm" data-act="openAbs" data-u="${u}">Fehlzeit eintragen</button>` : `<button class="btn btn-ghost btn-sm" data-act="openAbs" data-ty="krank" data-u="${u}">Krank melden</button><button class="btn btn-ghost btn-sm" data-act="openAbs" data-ty="urlaub" data-u="${u}">Urlaub beantragen</button>`}</div></div>` +
    (up.length ? `<div class="list" style="margin-top:10px">${up.map(absRow).join('')}</div>` : '') + '</div>' +
    `<div class="card"><div class="row between"><h3>Heute</h3><button class="btn btn-ghost btn-sm" data-act="${vw.acting ? 'openEdit' : 'openReq'}" data-u="${u}">Zeit nachtragen</button></div>` +
    (td.length ? `<div class="list" style="margin-top:10px">${td.map((x) => entryRow(x, 'ma')).join('')}</div>` : '<p class="empty">Noch keine Zeit gebucht.</p>') + '</div></div>';
}

export function timesView(u, mode) {
  const list = monthEntries(u, V.month), worked = list.reduce((s, e) => s + netMin(e), 0), credit = monthCredit(u, V.month), tot = worked + credit;
  const days = {}; list.forEach((e) => { days[dkey(new Date(e.start))] = 1; });
  const pend = S.requests.filter((r) => r.userId === u && r.status === 'pending');
  const vw = viewer(), direct = mode === 'chef' || (vw && vw.acting);
  return `<div class="stack"><div class="card">${monthNav()}` +
    `<div class="stats" style="margin-top:14px"><div class="stat"><div class="eyebrow">Gearbeitet</div><div class="v num">${hm(worked)}</div></div>` +
    `<div class="stat"><div class="eyebrow">Fehlzeit bezahlt</div><div class="v num">${hm(credit)}</div><div class="s">Krank und Urlaub</div></div>` +
    `<div class="stat"><div class="eyebrow">Arbeitstage</div><div class="v num">${Object.keys(days).length}</div></div>` +
    (mode === 'chef' ? `<div class="stat"><div class="eyebrow">Brutto (geschätzt)</div><div class="v num">${eur(tot / 60 * S.settings.wage)}</div><div class="s">ohne Zuschläge</div></div>` : '') + '</div></div>' +
    absCard(u, direct) + vacCard(u) +
    (pend.length ? `<div class="card"><h3>Wartet auf Bestätigung</h3><div class="list" style="margin-top:10px">${pend.map((r) => reqRow(r, false)).join('')}</div></div>` : '') +
    `<div class="card"><div class="row between"><h3>Gebuchte Zeiten</h3><div class="row">${mode === 'chef' ? `<button class="btn btn-ghost btn-sm" data-act="csv" data-u="${u}">Liste exportieren</button>` : ''}<button class="btn btn-ghost btn-sm" data-act="${direct ? 'openEdit' : 'openReq'}" data-u="${u}">Zeit nachtragen</button></div></div>` +
    (list.length ? groupWeeks(list, mode) : '<p class="empty">In diesem Monat gibt es keine Einträge.</p>') + '</div></div>';
}

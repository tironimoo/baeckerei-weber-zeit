import { S, V } from '../store.js';
import { ABS, absDates, closureOn, dayMins, flags, monthAbs, netMin, userById, vacationInfo, weekCredit, weekSoll } from '../calc.js';
import { DAYS, ICONS, esc, fmtD, fmtDay, fmtT, hm, isoWeek, MONTHS, pd, sod, dkey, wstart } from '../util.js';
import { isChef, viewer } from '../session.js';

export const brand = () => `<div class="brand"><div class="logo">${ICONS.logo}</div><div style="min-width:0"><div class="brand-name">${esc(S.settings.business)}</div><div class="brand-sub">Zeiterfassung</div></div></div>`;

export function weekCard(u) {
  const now = new Date(), ws = wstart(now), days = dayMins(u, ws), worked = days.reduce((a, b) => a + b, 0), credit = weekCredit(u, ws), wm = worked + credit, soll = weekSoll(ws);
  const cnt = days.filter((m) => m > 0).length, td = Math.round((sod(now) - ws) / 864e5), closed = soll === 0;
  const scale = Math.max(soll, wm, 60) * 1.12, fill = Math.min(100, wm / scale * 100), mark = soll / scale * 100;
  const max = Math.max(480, ...days);
  const diff = soll - wm;
  const note = closed ? 'Betriebsferien: diese Woche gibt es kein Soll' : (diff > 0 ? `Noch ${hm(diff)} Std. bis zum Wochensoll` : (diff === 0 ? 'Wochensoll erreicht' : `Über Soll: +${hm(-diff)} Std.`));
  return `<div class="card"><div class="row between"><div><div class="eyebrow">Diese Woche</div><div class="row" style="gap:8px;align-items:baseline"><h2 class="num">${hm(wm)}</h2><span class="muted num">von ${hm(soll)} Std.</span></div></div>` +
    (closed ? '<span class="chip crust">Betriebsferien</span>' : `<span class="chip ${cnt > S.settings.workDays ? 'warn' : 'crust'}">${cnt} von ${S.settings.workDays} Arbeitstagen</span>`) + '</div>' +
    `<div class="prog" role="img" aria-label="${hm(wm)} von ${hm(soll)} Stunden"><div class="fill${wm > soll ? ' over' : ''}" style="width:${fill.toFixed(1)}%"></div>${soll > 0 ? `<div class="mark" style="left:calc(${mark.toFixed(1)}% - 1px)"></div>` : ''}</div>` +
    `<div class="prog-l"><span>${note}</span><span>${credit > 0 ? 'inkl. ' + hm(credit) + ' Fehlzeit' : 'Soll ' + hm(soll)}</span></div>` +
    '<div class="bars">' + days.map((m, i) => `<div class="bar${m <= 0 ? ' zero' : ''}${i === td ? ' today' : ''}"><span class="v num">${m > 0 ? hm(m) : ''}</span><i style="height:${Math.max(3, Math.round(m / max * 84))}px"></i><span class="l">${DAYS[i]}</span></div>`).join('') + '</div></div>';
}

export function entryRow(e, mode) {
  const s = new Date(e.start), en = e.end ? new Date(e.end) : null, fl = flags(e);
  const st = e.breakStart ? 'In Pause' : (!en ? 'Im Dienst' : '');
  const vw = viewer();
  const act = mode === 'ma' && !(vw && vw.acting) ? `<button class="linkbtn" data-act="openReq" data-e="${e.id}">Korrektur beantragen</button>` : `<button class="linkbtn" data-act="openEdit" data-e="${e.id}">Bearbeiten</button>`;
  return `<div class="item"><div style="min-width:0"><div class="t">${fmtDay(s)} · ${fmtT(s)}–${en ? fmtT(en) : '…'}</div>` +
    `<div class="s">Pause ${e.breakMin || 0} Min. · ${esc(e.source)}${e.note ? ' · ' + esc(e.note) : ''}</div>` +
    ((fl.length || st) ? `<div class="chips">${st ? `<span class="chip good">${st}</span>` : ''}${fl.map((f) => `<span class="chip ${f.c}">${f.t}</span>`).join('')}</div>` : '') + '</div>' +
    `<div class="r"><div class="t num">${hm(netMin(e))}</div>${act}</div></div>`;
}

export function monthNav() {
  const [y, m] = V.month.split('-').map(Number);
  return `<div class="mnav"><button class="btn btn-ghost" data-act="month" data-d="-1" aria-label="Vorheriger Monat">‹</button><h2>${MONTHS[m - 1]} ${y}</h2><button class="btn btn-ghost" data-act="month" data-d="1" aria-label="Nächster Monat">›</button></div>`;
}

export function groupWeeks(list, mode) {
  const g = {}, order = [];
  list.forEach((e) => { const k = dkey(wstart(new Date(e.start))); if (!g[k]) { g[k] = []; order.push(k); } g[k].push(e); });
  return order.map((k) => {
    const d = pd(k), e2 = new Date(d); e2.setDate(e2.getDate() + 6);
    const tot = g[k].reduce((s, e) => s + netMin(e), 0);
    return `<div class="week-h"><span>KW ${isoWeek(d)} · ${fmtD(d)}–${fmtD(e2)}</span><span class="num">${hm(tot)} Std.</span></div><div class="list">${g[k].map((e) => entryRow(e, mode)).join('')}</div>`;
  }).join('');
}

export function reqRow(r, showAct) {
  const d = pd(r.date);
  return `<div class="item"><div style="min-width:0"><div class="t">${esc(userById(r.userId).name)} · ${fmtDay(d)}</div><div class="s">${esc(r.start)}–${esc(r.end)} · Pause ${r.breakMin} Min. · ${r.entryId ? 'Korrektur' : 'Nachtrag'}</div><div class="s">„${esc(r.reason)}“</div></div>` +
    `<div class="r">${showAct ? `<button class="btn btn-primary btn-sm" data-act="approve" data-r="${r.id}">Annehmen</button><button class="btn btn-ghost btn-sm" data-act="reject" data-r="${r.id}">Ablehnen</button>` : '<span class="chip warn">Offen</span>'}</div></div>`;
}

export function vacCard(u) {
  const y = +V.month.split('-')[0], v = vacationInfo(u, y);
  return `<div class="card"><div class="eyebrow">Urlaubskonto ${y}</div><div class="stats" style="margin-top:10px">` +
    `<div class="stat"><div class="s">Anspruch</div><div class="v num">${v.ent}</div></div><div class="stat"><div class="s">Betriebsferien</div><div class="v num">${v.closure}</div></div>` +
    `<div class="stat"><div class="s">Eigener Urlaub</div><div class="v num">${v.own}</div></div><div class="stat"><div class="s">Rest</div><div class="v num">${v.rest}</div></div></div>` +
    (v.rest < 0 ? `<div class="chips"><span class="chip bad">Fehlbetrag ${-v.rest} Tage. Bitte im Arbeitsvertrag regeln.</span></div>` : '') + '</div>';
}

export function absRow(a) {
  const chef = isChef(), n = absDates(a).length, cal = Math.round((pd(a.to) - pd(a.from)) / 864e5) + 1;
  const st = { ok: ['good', 'Bestätigt'], pending: ['warn', 'Wartet auf Bestätigung'], no: ['bad', esc(a.why || 'Abgelehnt')] }[a.status];
  let act = '';
  if (chef && a.status === 'pending') act = `<button class="btn btn-primary btn-sm" data-act="absApprove" data-a="${a.id}">Bestätigen</button><button class="btn btn-ghost btn-sm" data-act="absReject" data-a="${a.id}">Ablehnen</button>`;
  else if (chef && a.status === 'ok') act = `<button class="linkbtn" data-act="absCancel" data-a="${a.id}">Stornieren</button>`;
  else if (!chef && a.status === 'pending') act = `<button class="linkbtn" data-act="absCancel" data-a="${a.id}">Zurückziehen</button>`;
  return `<div class="item"><div style="min-width:0"><div class="t">${ABS[a.type].n} · ${fmtD(pd(a.from))}${a.to !== a.from ? '–' + fmtD(pd(a.to)) : ''} (${cal}${cal === 1 ? ' Tag' : ' Tage'})</div>` +
    `<div class="s">${chef ? esc(userById(a.userId).name) + ' · ' : ''}${n < cal ? n + ' zählen (ohne Sonntage und Betriebsferien)' : 'alle Tage zählen'}${a.note ? ' · ' + esc(a.note) : ''}</div>` +
    `<div class="chips"><span class="chip ${st[0]}">${st[1]}</span>${a.type === 'krank' && cal > 3 ? '<span class="chip crust">Krankschreibung (AU) nötig</span>' : ''}</div></div><div class="r">${act}</div></div>`;
}

export function absCard(u, direct) {
  const list = monthAbs(u, V.month);
  const btns = direct ? `<button class="btn btn-ghost btn-sm" data-act="openAbs" data-u="${u}">Fehlzeit eintragen</button>` :
    `<button class="btn btn-ghost btn-sm" data-act="openAbs" data-ty="krank" data-u="${u}">Krank melden</button><button class="btn btn-ghost btn-sm" data-act="openAbs" data-ty="urlaub" data-u="${u}">Urlaub beantragen</button>`;
  return `<div class="card"><div class="row between"><h3>Fehlzeiten</h3><div class="row">${btns}</div></div>` +
    (list.length ? `<div class="list" style="margin-top:10px">${list.map(absRow).join('')}</div>` : '<p class="empty">In diesem Monat gibt es keine Fehlzeiten.</p>') + '</div>';
}

export { closureOn };

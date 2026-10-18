import { mkey } from './util.js';

/** Daten, die vom Server geladen wurden (nur Lesen für die Ansichten). */
export const S = {
  settings: { business: 'Bäckerei Weber', weeklyHours: 18, workDays: 3, wage: 13.9, vacationDays: 18, idleSec: 60, retentionYears: 2 },
  closures: [],
  users: [],
  entries: [],
  requests: [],
  absences: [],
  tags: [],
  audit: [],
};

/** Zustand der Oberfläche. */
export const V = {
  boot: 'loading', // loading | login | mfa | enroll | app
  session: null, // { role, uid, name, email, actingAs }
  device: 'phone', // tablet, sobald das Gerät als Geschäftstablet eingerichtet ist
  screen: 'home', // home | login | setup
  tab: 'today',
  month: mkey(new Date()),
  modal: null,
  done: null,
  toast: null,
  err: '',
  info: '',
  busy: false,
  mfa: null, // { factorId, qr, secret }
  lastAct: Date.now(),
  doneTimer: null,
  nfcActive: false,
};

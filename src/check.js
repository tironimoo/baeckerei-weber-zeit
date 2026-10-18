import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

/** Systemprüfung ohne Anmeldung: sieht nach, ob Supabase so eingerichtet ist wie vorgesehen. */
export async function runChecks() {
  const H = { apikey: SUPABASE_KEY };
  const host = SUPABASE_URL.replace('https://', '');
  const out = [];
  const add = (name, state, hint) => out.push({ name, state, hint });
  const json = (r) => r.json().catch(() => ({}));

  let auth;
  try {
    const r = await fetch(SUPABASE_URL + '/auth/v1/settings', { headers: H });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    auth = await r.json();
    add('Server erreichbar', 'ok', host);
  } catch (e) {
    add('Server erreichbar', 'bad', `Keine Verbindung zu ${host}. Stimmt die Adresse? Ist das Projekt pausiert (Supabase-Dashboard, „Restore project“)? Gibt es Internet?`);
    return out;
  }

  add('Selbst-Anmeldung ausgeschaltet', auth.disable_signup === true ? 'ok' : 'bad',
    auth.disable_signup === true ? 'Neue Konten kann nur die Chefin anlegen.' : 'Noch an! Supabase, Authentication, Sign In / Providers: „Allow new users to sign up“ ausschalten und speichern.');

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/settings?select=business`, { headers: H });
    const b = await json(r);
    if (r.status === 404 || b.code === 'PGRST205' || /Could not find the table/i.test(b.message || '')) {
      add('Datenbank-Tabellen angelegt', 'bad', 'Tabellen fehlen. SQL Block A ist noch nicht (erfolgreich) gelaufen.');
    } else if (r.status === 401 || r.status === 403 || b.code === '42501') {
      add('Datenbank-Tabellen angelegt und gesperrt', 'ok', 'Ohne Anmeldung ist nichts lesbar.');
    } else if (r.ok) {
      add('Datenbank-Tabellen angelegt und gesperrt', 'bad', 'Ohne Anmeldung lesbar! SQL Block A erneut prüfen und mir Bescheid geben.');
    } else {
      add('Datenbank-Tabellen angelegt und gesperrt', 'warn', `Unerwartete Antwort (${r.status}).`);
    }
  } catch (e) { add('Datenbank-Tabellen angelegt und gesperrt', 'warn', 'Prüfung nicht möglich: ' + e.message); }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/kiosk_stamp`, { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: '{"p_tag":"x"}' });
    const b = await json(r);
    if (r.status === 404 || b.code === 'PGRST202') add('Stempel-Funktionen angelegt', 'bad', 'Funktionen fehlen. SQL Block A ist noch nicht (vollständig) gelaufen.');
    else if (r.status === 401 || r.status === 403 || b.code === '42501') add('Stempel-Funktionen angelegt und gesperrt', 'ok', 'Ohne Anmeldung kann niemand stempeln.');
    else add('Stempel-Funktionen angelegt und gesperrt', 'bad', `Ohne Anmeldung nicht gesperrt (${r.status})!`);
  } catch (e) { add('Stempel-Funktionen angelegt und gesperrt', 'warn', 'Prüfung nicht möglich: ' + e.message); }

  add('Konten, Rollen und Authenticator', 'warn', 'Das lässt sich nur mit Anmeldung prüfen: Als Chefin anmelden. Kommt „Authenticator einrichten“, passt alles. Kommt „noch nicht freigeschaltet“, fehlt SQL Block B.');
  return out;
}

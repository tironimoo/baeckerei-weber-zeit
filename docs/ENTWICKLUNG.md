# Entwicklung

```bash
npm install
npm run build        # baut nach dist/
npm run serve        # lokal ansehen: http://localhost:8080/?demo
npm test             # Klick-Test im Übungsmodus (braucht Playwright-Chromium)
npm run test:db      # prüft Datenbank und Datenschicht gegen lokale PostgreSQL + PostgREST
```

## Aufbau der App

- `src/main.js` Ereignisse, Aktionen, Start. Alle Änderungen laufen über `run(...)`: Fehler freundlich anzeigen, danach neu laden.
- `src/api/supabase.js` die echte Anbindung, `src/api/demo.js` der Übungsmodus mit gleicher Schnittstelle. Die Regeln des Stempelns stehen **zweimal**: in `supabase/schema.sql` (maßgeblich) und in `demo.js`.
- `src/calc.js` Rechenregeln (Wochensoll, Betriebsferien, Fehlzeiten, Urlaubskonto).
- `src/views/` Oberfläche als Textbausteine; alles Nutzerseitige geht durch `esc()`.
- Zwei getrennte Anmeldungen im Browser: Person (`bwz-user`) und Tablet-Konto (`bwz-kiosk`).

## Datenbank ändern

`supabase/schema.sql` ist der Anfangszustand. Spätere Änderungen als neue, nummerierte Skripte ergänzen (`03_…sql`) und im SQL Editor ausführen. Danach `npm run test:db` anpassen und laufen lassen.

`test:db` braucht: PostgreSQL (`psql`, ein laufender Server; Zugangsdaten über `PGHOST`, `PGPORT`, `PGUSER`) und die PostgREST-Datei (`POSTGREST=/pfad/postgrest`). Es spielt die Datenbank in einer Testdatenbank ein, simuliert Supabase-Anmeldung mit selbst signierten Tokens und prüft jede Rolle: Mitarbeiterin, Chefin ohne und mit Authenticator, Tablet, ohne Anmeldung.

## Was bisher nur von Hand geprüft werden kann

- Anmeldung, Authenticator (TOTP) und Passwortwechsel gegen das echte Supabase.
- NFC-Lesen auf dem echten Tablet (Web NFC), auch in der Android-App.
- Das nächtliche Löschen mit pg_cron.

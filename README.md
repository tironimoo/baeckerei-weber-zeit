# Bäckerei Weber · Zeiterfassung

Arbeitszeiten stempeln und verwalten, für den Familienbetrieb. Eine Web-App, die auf dem Handy der Mitarbeiterin
und auf dem Geschäftstablet läuft, dazu eine Android-App mit denselben Funktionen.

**Funktionen**
- Kommen, Pause, Gehen per Knopfdruck am Handy. Immer mit Serverzeit, nichts lässt sich rückdatieren.
- Am Geschäftstablet einfach den NFC-Tag davorhalten: ohne Anmeldung ein- und ausstempeln.
- Chefin: Übersicht, Zeiten bestätigen und korrigieren, Fehlzeiten (Krank, Urlaub), Betriebsferien, Urlaubskonto, Monatsliste, Protokoll.
- Wochensoll 18 Std. an 3 Tagen, alles in den Einstellungen änderbar.
- Anmeldung der Chefin mit Authenticator-App (zweiter Faktor).

**Datenschutz in Kürze:** keine fremden Dienste im Browser (Schriften und Code liegen im Projekt), Daten in Supabase
(Rechenzentrum in der EU, derzeit Irland), jede Änderung im Protokoll, automatische Löschung nach 2 Jahren. Details: [docs/DATENSCHUTZ.md](docs/DATENSCHUTZ.md).

## Loslegen

| Ich möchte … | Datei |
|---|---|
| die Datenbank und die Konten einrichten | [docs/EINRICHTUNG.md](docs/EINRICHTUNG.md) |
| wissen, was gespeichert wird (Vorlagen für Infoblatt und Verzeichnis) | [docs/DATENSCHUTZ.md](docs/DATENSCHUTZ.md) |
| an der App weiterbauen | [docs/ENTWICKLUNG.md](docs/ENTWICKLUNG.md) |

Ausprobieren ohne Konto: Die App mit `?demo` an der Adresse öffnen (Übungsmodus, Daten bleiben nur im Browser).

## Aufbau

```
src/            App (Oberfläche, Rechenregeln, Anbindung an Supabase, Übungsmodus)
supabase/       Datenbank: schema.sql und Hilfsskripte
tests/          Klick-Test der App (e2e.mjs) und Test der Datenbank (db/)
scripts/        Build, Symbole, Android-Anpassung
.github/        Prüfung, Veröffentlichung der Web-App, Bau der Android-App
```

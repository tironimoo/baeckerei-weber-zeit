# Datenschutz und Sicherheit

> Vorlagen und technische Beschreibung. Das ist keine Rechtsberatung. Bitte einmal vom Steuerberater oder einer Datenschutzberatung gegenlesen lassen.

## Was gespeichert wird

| Daten | Wozu | Wie lange |
|---|---|---|
| Name, E-Mail | Anmeldung, Zuordnung der Zeiten | solange das Arbeitsverhältnis besteht, danach Konto löschen |
| Beginn, Ende, Pause, Quelle (Handy, Tablet, Chefin), Serverzeit | Arbeitszeitnachweis | 2 Jahre, danach automatische Löschung |
| Fehlzeiten (nur „Krank“, „Urlaub“, „Frei“, Zeitraum, kurze Notiz) | Abrechnung, Urlaubskonto | 2 Jahre |
| Anträge auf Korrektur mit Begründung | Nachvollziehbarkeit | 2 Jahre |
| Fingerabdruck (SHA-256-Hash) der NFC-Tag-Nummer | Ein- und Ausstempeln am Tablet | bis der Tag gelöscht wird |
| Änderungsprotokoll (wer, wann, was) | Nachweis, Schutz vor Manipulation | 2 Jahre |

Nicht gespeichert: Standort, Fotos, Gerätekennungen, Diagnosen, Analysedaten, Werbe-IDs. In der App läuft kein Fremdcode und kein Fremdserver (außer Supabase), Schriften und Skripte liegen im Projekt.

**Krankmeldungen:** Es wird nur „Krank“ und der Zeitraum erfasst, nie eine Diagnose. Auch das sind Gesundheitsdaten (Art. 9 DSGVO), verarbeitet auf Grundlage des Arbeitsrechts (§ 26 Abs. 3 BDSG).

## Rechtsgrundlagen (Orientierung)

- Durchführung des Beschäftigungsverhältnisses: Art. 6 Abs. 1 lit. b DSGVO i. V. m. § 26 BDSG.
- Gesetzliche Pflicht zur Arbeitszeiterfassung: Art. 6 Abs. 1 lit. c DSGVO (Arbeitszeitgesetz, Rechtsprechung des Bundesarbeitsgerichts zur Zeiterfassung).
- Aufbewahrung der Arbeitszeitnachweise: 2 Jahre. Lohn- und Buchhaltungsunterlagen beim Steuerberater haben eigene, längere Fristen.

## Empfänger und Auftragsverarbeiter

| Wer | Was | Absicherung |
|---|---|---|
| Supabase (Rechenzentrum in der EU, Irland) | Datenbank und Anmeldung | Auftragsverarbeitungsvertrag (DPA) annehmen, siehe Einrichtung Schritt 1.7 |
| GitHub (GitHub Pages) | liefert die Web-App aus (nur Programmcode) | GitHub sieht beim Aufruf der Seite die IP-Adresse der Nutzerin. Im Infoblatt erwähnen. |
| Steuerberater | Auswertung der Monatslisten | eigene Vereinbarung |

## Technische und organisatorische Maßnahmen

- Zugriffsregeln in der Datenbank (Row Level Security): die Mitarbeiterin sieht nur ihre Daten, das Tablet nur eine einzige Funktion, ohne Anmeldung nichts.
- Chefin nur mit Passwort **und** Authenticator-Code; ohne Code greifen die Berechtigungen nicht.
- Stempeln immer mit Serverzeit. Beginn und Ende kann die Mitarbeiterin nicht selbst ändern, nur Korrekturen beantragen.
- Änderungsprotokoll wird von der Datenbank selbst geschrieben und kann von keinem Konto gelöscht werden.
- Rolle und E-Mail eines Kontos lassen sich nicht über die App ändern, nur direkt in der Datenbank.
- Verschlüsselte Übertragung (HTTPS), keine Fremdskripte (Content-Security-Policy), keine Cookies, nur der notwendige Anmeldespeicher im Browser.
- Passwortregeln (mindestens 10 Zeichen), Sperren bei zu vielen Versuchen durch Supabase.
- Am Geschäftstablet endet jede Anmeldung nach kurzer Ruhe; das Startbild zeigt keine Namen oder Zeiten.
- Tags sind Komfort, kein Passwort: sie können nur stempeln, verlorene Tags lassen sich sofort sperren.

## Vorlage: Eintrag im Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)

| Feld | Eintrag |
|---|---|
| Verantwortlicher | Bäckerei Weber, [Inhaberin, Anschrift, Kontakt] |
| Bezeichnung | Arbeitszeiterfassung |
| Zweck | Erfassung und Nachweis der Arbeitszeit, Abrechnung, Urlaubs- und Fehlzeiten |
| Betroffene | Beschäftigte |
| Datenarten | Name, E-Mail, Arbeitszeiten, Pausen, Fehlzeiten (ohne Diagnose), Tag-Hash, Protokolldaten |
| Empfänger | Supabase (Auftragsverarbeiter, EU), Steuerberater, GitHub (nur Auslieferung der App) |
| Drittlandübermittlung | keine Speicherung außerhalb der EU; GitHub erhält technisch IP-Adressen (USA, EU-US Data Privacy Framework) |
| Löschfristen | Arbeitszeiten 2 Jahre, Konten nach Ende des Arbeitsverhältnisses |
| Maßnahmen | siehe oben |

## Vorlage: Infoblatt für Beschäftigte (Art. 13 DSGVO)

**Zeiterfassung in der Bäckerei Weber**

Wir erfassen deine Arbeitszeit, weil wir dazu gesetzlich verpflichtet sind und sie für die Lohnabrechnung brauchen.
Gespeichert werden dein Name, deine E-Mail-Adresse, Beginn, Ende und Pausen deiner Arbeit, Urlaub und Krankmeldungen (nur „krank“, ohne Diagnose) sowie ein Protokoll von Änderungen. Wir erfassen keinen Standort und machen keine Fotos.
Die Daten liegen bei Supabase in einem Rechenzentrum in der EU, in Irland (Auftragsverarbeiter mit Vertrag). Die App wird über GitHub ausgeliefert, dabei sieht GitHub technisch deine IP-Adresse. Auswertungen gehen an unsere Steuerberatung.
Wir löschen deine Zeiten automatisch nach 2 Jahren.
Du hast das Recht auf Auskunft, Berichtigung, Löschung (soweit keine Pflicht zur Aufbewahrung besteht), Einschränkung der Verarbeitung und Beschwerde bei der Datenschutzaufsicht (für Hessen: Der Hessische Beauftragte für Datenschutz und Informationsfreiheit).
Fragen an: [Name, Kontakt].

## Wenn jemand das Unternehmen verlässt

1. In der App unter *Einstellungen > Personen* deaktivieren.
2. Zeiten der letzten 2 Jahre bleiben bis zur automatischen Löschung (Nachweispflicht).
3. Konto später in Supabase (*Authentication > Users*) löschen. Das entfernt auch den Zugang.

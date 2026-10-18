# Einrichtung

Dauer etwa 30 Minuten. Menünamen bei Supabase und GitHub ändern sich gelegentlich leicht, die Bezeichnungen unten sind die im Oktober 2026 üblichen.

## 1. Supabase-Projekt

1. Auf supabase.com mit dem GitHub-Konto anmelden, **New project**. Name `baeckerei-weber-zeit`, **Region: Central EU (Frankfurt)**, Plan Free. Die Region lässt sich später nicht mehr ändern. Prüfen: *Project Settings > General*.
2. **SQL Editor > New query**, den ganzen Inhalt von `supabase/schema.sql` einfügen, **Run**. Erwartet: *Success. No rows returned*. Nur einmal ausführen.
3. **Authentication > Sign In / Providers** (oder *Settings*): **„Allow new users to sign up“ ausschalten.** Sonst kann sich jeder ein Konto anlegen.
4. Im selben Bereich die Mindestlänge für Passwörter auf 10 setzen. Unter **Authentication > Multi-Factor** muss TOTP (Authenticator-App) aktiv sein.
5. **Project Settings > API:** *Project URL* und *Publishable key* in `src/config.js` eintragen (beide sind für den Browser gedacht). Den *Secret key* (`sb_secret_…`) nie weitergeben und nie einchecken.
6. Optional: Unter *Database > Extensions* **pg_cron** einschalten und `supabase/02_naechtliche_loeschung.sql` ausführen. Das löscht Zeiten nach der Aufbewahrungsfrist automatisch.
7. Den **Auftragsverarbeitungsvertrag** (DPA) von Supabase annehmen: *Organization settings > Legal documents*. Eine Kopie zu den Unterlagen legen.

## 2. Konten

Unter **Authentication > Users > Add user > Create new user** je ein Konto anlegen, **Auto Confirm User** anhaken, ein starkes Passwort vergeben:

| Konto | wofür |
|---|---|
| Chefin | Verwaltung, Anmeldung mit Authenticator |
| Tablet | nur für das Geschäftstablet, kann ausschließlich stempeln |
| Mitarbeiterin | Handy, später |

Danach im SQL Editor `supabase/01_konten.sql.example` mit den echten E-Mail-Adressen ausführen (macht das eine Konto zur Chefin und das andere zum Tablet-Konto). Die Mitarbeiterin bekommt ihr Konto später; sie erscheint dann in der App unter *Einstellungen > Personen*, wo die Chefin ihren Namen einträgt.

## 3. Web-App veröffentlichen

1. GitHub: *Settings > Pages > Source: **GitHub Actions***. Danach baut und veröffentlicht jede Änderung an `main` die App unter `https://<konto>.github.io/baeckerei-weber-zeit/`.
2. Dieses Repository ist öffentlich. Darin steht nur Programmcode, keine Daten. Die Datenbank schützen Anmeldung und Zugriffsregeln.

## 4. Erste Anmeldung der Chefin

1. App öffnen, mit E-Mail und Passwort anmelden.
2. Beim ersten Mal erscheint **Authenticator einrichten**: App installieren (zum Beispiel Aegis, Google oder Microsoft Authenticator), QR-Code scannen, den 6-stelligen Code eingeben.
3. Danach fragt jede Anmeldung nach dem Code. Ohne Code sieht die Chefin nichts, auch nicht mit richtigem Passwort.
4. **Wichtig:** Den Schlüssel (Text unter dem QR-Code) oder eine Sicherung der Authenticator-App aufheben. Geht das Handy verloren, hilft sonst nur die Wiederherstellung über Supabase (*Authentication > Users > Faktor entfernen*).

## 5. Geschäftstablet

1. App auf dem Tablet in **Chrome** öffnen, Menü > **Zum Startbildschirm hinzufügen** (installiert die App).
2. Anmeldeseite > **Als Geschäftstablet einrichten**, E-Mail und Passwort des Tablet-Kontos eingeben.
3. **NFC aktivieren** tippen und die Berechtigung erlauben. Das Tablet bleibt wach und liest Tags.
4. Chefin: *NFC-Tags > Neuen Tag anlernen*, Tag ans Tablet halten, Namen und Person wählen.

Gespeichert wird nur ein Fingerabdruck (Hash) der Tag-Nummer. Ein verlorener Tag wird unter *NFC-Tags* gesperrt.

## 6. Mitarbeiterin

1. Konto in Supabase anlegen (Schritt 2), Passwort mitteilen. Sie ändert es beim ersten Mal unter *Namen antippen > Mein Konto*.
2. Auf dem Android-Handy die App installieren (Chrome > Zum Startbildschirm hinzufügen, oder die APK aus *Releases*). Mit dem iPhone geht die Web-Version im Browser.
3. Name in der App eintragen: Chefin, *Einstellungen > Personen*.

## 7. Android-App (APK)

Sie wird automatisch gebaut: GitHub > *Actions > Android-App bauen > Run workflow*. Die Datei `weber-zeit.apk` liegt danach beim Lauf unter *Artifacts*. Mit einem Versions-Tag (`v1.0.0`) landet sie in *Releases*.
Zum Installieren auf dem Handy: Datei öffnen und „Installation aus dieser Quelle“ erlauben. Die APK ist mit einem Debug-Schlüssel signiert, Updates brauchen daher vorher eine Deinstallation. Für ein sauber signiertes Release lässt sich später ein eigener Schlüssel hinterlegen.

## Wenn etwas hakt

| Problem | Ursache und Lösung |
|---|---|
| „Dieses Konto ist noch nicht freigeschaltet“ | Profil fehlt oder ist deaktiviert. `01_konten.sql.example` ausgeführt? Unter *Einstellungen > Personen* aktiv? |
| Chefin sieht nichts / „fehlende Berechtigung“ | Anmeldung ohne Authenticator-Code. Abmelden, neu anmelden, Code eingeben. |
| Tablet liest keinen Tag | Chrome auf Android nötig, NFC im Tablet an, „NFC aktivieren“ getippt. Tag-Typ: NTAG213/215 (13,56 MHz). |
| „Keine Verbindung zum Server“ | Internet prüfen. Stempeln braucht Verbindung, weil die Serverzeit zählt. |
| Projekt „pausiert“ | Gratis-Projekte pausieren nach 7 Tagen ohne Nutzung. Im Supabase-Dashboard auf *Restore* tippen. |

## Datensicherung

Der kostenlose Supabase-Tarif macht **keine automatischen Sicherungen**. Darum: Die Chefin exportiert einmal im Monat die Monatsliste (*Zeiten > Liste exportieren > Kopieren*) und legt sie ab, zum Beispiel in den Unterlagen für den Steuerberater. Wer mehr Sicherheit will, nimmt den Pro-Tarif (Tagessicherungen, etwa 25 US-Dollar im Monat).
Sicherungen gehören nie in dieses (öffentliche) Repository und nie in einen öffentlichen GitHub-„Artifact“.

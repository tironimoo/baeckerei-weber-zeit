-- Optional, aber empfohlen: löscht nachts Zeiten, die älter sind als die Aufbewahrungsfrist (Standard 2 Jahre).
-- Vorher in Supabase unter Database > Extensions "pg_cron" einschalten.
-- Hinweis: Diese Datei konnte ohne Supabase-Konto nicht getestet werden. Läuft sie mit Fehler, melde dich.
select cron.schedule('zeiten-aufraeumen', '30 3 * * *', $$select public.purge_old()$$);
-- Kontrolle:  select * from cron.job;

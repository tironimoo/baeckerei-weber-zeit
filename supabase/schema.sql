-- Bäckerei Weber Zeiterfassung: Datenbank für Supabase (PostgreSQL)
-- Einfügen unter "SQL Editor" und auf "Run" drücken. Es läuft genau einmal:
-- danach ist die Datenbank fertig (zweites Ausführen meldet "already exists").
--
-- Sicherheitsidee:
--  * Niemand ohne Anmeldung sieht oder ändert etwas.
--  * Die Mitarbeiterin sieht nur ihre eigenen Zeiten und stempelt über Funktionen,
--    die immer die Serverzeit benutzen. Zeiten selbst ändern kann sie nicht.
--  * Das Tablet hat ein eigenes Konto und darf nur "kiosk_stamp" aufrufen.
--  * Die Chefin braucht für alle Änderungen zusätzlich den Authenticator-Code (aal2).
--  * Jede Änderung landet automatisch im Protokoll (audit_log).

-- ============================================================
-- 1. Tabellen
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text not null default '',
  role        text not null default 'ma' check (role in ('chef','ma','kiosk')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.settings (
  id              int primary key default 1 check (id = 1),
  business        text not null default 'Bäckerei Weber' check (length(business) between 1 and 40),
  weekly_hours    numeric(4,1) not null default 18   check (weekly_hours between 1 and 40),
  work_days       int not null default 3             check (work_days between 1 and 6),
  wage            numeric(6,2) not null default 13.90 check (wage >= 0),
  vacation_days   int not null default 18            check (vacation_days between 0 and 60),
  idle_sec        int not null default 60            check (idle_sec between 15 and 600),
  retention_years int not null default 2             check (retention_years between 2 and 10)
);
insert into public.settings default values;

create table public.closures (
  id         uuid primary key default gen_random_uuid(),
  label      text not null check (length(label) between 1 and 60),
  date_from  date not null,
  date_to    date not null,
  check (date_to >= date_from)
);
-- Hessische Sommerferien 2027 (Schulferien 28.06.-06.08.), 6 Wochen. In der App änderbar.
insert into public.closures (label, date_from, date_to)
values ('Betriebsferien (Hessische Sommerferien 2027)', '2027-06-28', '2027-08-08');

create table public.time_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id),
  start_at    timestamptz not null default now(),
  end_at      timestamptz,
  break_min   int not null default 0 check (break_min between 0 and 240),
  break_start timestamptz,
  source      text not null check (source in ('Handy','Tablet','Tablet-NFC','Chefin','Nachtrag')),
  note        text not null default '' check (length(note) <= 120),
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  check (end_at is null or end_at > start_at),
  check (end_at is null or end_at - start_at <= interval '16 hours')
);
create index on public.time_entries (user_id, start_at);
create unique index one_open_entry on public.time_entries (user_id) where end_at is null;

create table public.change_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id),
  entry_id    uuid references public.time_entries(id),
  work_date   date not null,
  start_time  time not null,
  end_time    time not null,
  break_min   int not null default 0 check (break_min between 0 and 240),
  reason      text not null check (length(trim(reason)) >= 3 and length(reason) <= 200),
  status      text not null default 'pending' check (status in ('pending','ok','no')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  uuid,
  check (end_time > start_time)
);

create table public.absences (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id),
  type        text not null check (type in ('krank','urlaub','sonst')),
  date_from   date not null,
  date_to     date not null,
  note        text not null default '' check (length(note) <= 120),
  status      text not null default 'pending' check (status in ('pending','ok','no')),
  why         text,
  created_at  timestamptz not null default now(),
  check (date_to >= date_from and date_to - date_from <= 60)
);

create table public.nfc_tags (
  id          uuid primary key default gen_random_uuid(),
  uid_hash    text not null unique,
  label       text not null check (length(label) between 1 and 30),
  user_id     uuid not null references public.profiles(id),
  active      boolean not null default true,
  last_used   timestamptz,
  created_at  timestamptz not null default now()
);

create table public.audit_log (
  id         bigint generated always as identity primary key,
  ts         timestamptz not null default now(),
  actor      uuid,
  actor_name text,
  tbl        text,
  op         text,
  row_id     text,
  old_row    jsonb,
  new_row    jsonb
);
create index on public.audit_log (ts desc);

-- ============================================================
-- 2. Hilfsfunktionen
-- ============================================================
create function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

-- Chefin zählt nur mit Authenticator-Code (aal2)
create function public.is_chef() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'chef', false)
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

-- Neue Anmeldung legt automatisch ein Profil als Mitarbeiterin an
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rolle ändert nur, wer direkt in der Datenbank arbeitet (SQL Editor), nie über die App
create function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and (new.role <> old.role or new.id <> old.id or new.email is distinct from old.email) then
    raise exception 'Rolle und E-Mail ändert man nicht über die App';
  end if;
  return new;
end $$;
create trigger guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- ============================================================
-- 3. Protokoll: jede Änderung wird automatisch festgehalten
-- ============================================================
create function public.audit_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare jold jsonb; jnew jsonb; nm text;
begin
  if coalesce(current_setting('app.purge', true), '') = 'on' then return old; end if;
  if tg_op <> 'INSERT' then jold := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then jnew := to_jsonb(new); end if;
  select full_name into nm from public.profiles where id = auth.uid();
  insert into public.audit_log (actor, actor_name, tbl, op, row_id, old_row, new_row)
  values (auth.uid(), coalesce(nm, 'System'), tg_table_name, tg_op, coalesce(jnew ->> 'id', jold ->> 'id'), jold, jnew);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger audit after insert or update or delete on public.time_entries    for each row execute function public.audit_trg();
create trigger audit after insert or update or delete on public.change_requests for each row execute function public.audit_trg();
create trigger audit after insert or update or delete on public.absences        for each row execute function public.audit_trg();
create trigger audit after insert or update or delete on public.nfc_tags        for each row execute function public.audit_trg();
create trigger audit after insert or update or delete on public.settings        for each row execute function public.audit_trg();
create trigger audit after insert or update or delete on public.closures        for each row execute function public.audit_trg();
create trigger audit after insert or update or delete on public.profiles        for each row execute function public.audit_trg();

-- Die Mitarbeiterin darf eine Fehlzeit nur beantragen und zurückziehen
create function public.absences_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_chef() then return new; end if;
  if tg_op = 'INSERT' then
    if new.user_id <> auth.uid() or new.status <> 'pending' then raise exception 'Nur eigene Anträge'; end if;
    return new;
  end if;
  if not (old.status = 'pending' and new.status = 'no'
          and new.user_id = old.user_id and new.type = old.type
          and new.date_from = old.date_from and new.date_to = old.date_to) then
    raise exception 'Die Mitarbeiterin darf einen Antrag nur zurückziehen';
  end if;
  new.why := 'Zurückgezogen';
  return new;
end $$;
create trigger guard before insert or update on public.absences
  for each row execute function public.absences_guard();

-- ============================================================
-- 4. Zugriffsregeln (Row Level Security)
-- ============================================================
alter table public.profiles        enable row level security;
alter table public.settings        enable row level security;
alter table public.closures        enable row level security;
alter table public.time_entries    enable row level security;
alter table public.change_requests enable row level security;
alter table public.absences        enable row level security;
alter table public.nfc_tags        enable row level security;
alter table public.audit_log       enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.settings to authenticated;
grant select, insert, update, delete on public.closures to authenticated;
grant select, insert, update on public.time_entries to authenticated;
grant select, insert, update on public.change_requests to authenticated;
grant select, insert, update on public.absences to authenticated;
grant select, insert, update, delete on public.nfc_tags to authenticated;
grant select on public.audit_log to authenticated;

create policy profiles_read   on public.profiles for select to authenticated using (id = auth.uid() or public.is_chef());
create policy profiles_chef   on public.profiles for update to authenticated using (public.is_chef()) with check (public.is_chef());

create policy settings_read   on public.settings for select to authenticated using (public.my_role() in ('chef','ma'));
create policy settings_chef   on public.settings for update to authenticated using (public.is_chef()) with check (public.is_chef());

create policy closures_read   on public.closures for select to authenticated using (public.my_role() in ('chef','ma'));
create policy closures_chef   on public.closures for all    to authenticated using (public.is_chef()) with check (public.is_chef());

-- Zeiten: lesen darf man die eigenen, schreiben nur die Chefin (Mitarbeiterin und Tablet stempeln über Funktionen)
create policy entries_read    on public.time_entries for select to authenticated using (user_id = auth.uid() or public.is_chef());
create policy entries_insert  on public.time_entries for insert to authenticated with check (public.is_chef());
create policy entries_update  on public.time_entries for update to authenticated using (public.is_chef()) with check (public.is_chef());

create policy requests_read   on public.change_requests for select to authenticated using (user_id = auth.uid() or public.is_chef());
create policy requests_insert on public.change_requests for insert to authenticated
  with check ((user_id = auth.uid() and status = 'pending' and public.my_role() = 'ma') or public.is_chef());
create policy requests_update on public.change_requests for update to authenticated using (public.is_chef()) with check (public.is_chef());

create policy absences_read   on public.absences for select to authenticated using (user_id = auth.uid() or public.is_chef());
create policy absences_insert on public.absences for insert to authenticated
  with check ((user_id = auth.uid() and public.my_role() = 'ma') or public.is_chef());
create policy absences_update on public.absences for update to authenticated
  using (public.is_chef() or (user_id = auth.uid() and status = 'pending'))
  with check (public.is_chef() or user_id = auth.uid());

create policy tags_chef       on public.nfc_tags  for all    to authenticated using (public.is_chef()) with check (public.is_chef());
create policy audit_read      on public.audit_log for select to authenticated using (public.is_chef());

-- ============================================================
-- 5. Stempel-Funktionen (immer mit Serverzeit)
-- ============================================================
-- Kern: Kommen oder Gehen für eine Person
create function public.do_stamp(p_user uuid, p_source text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e public.time_entries; nm text; first text; v_now timestamptz := now();
  last_ts timestamptz; work_min numeric; today_start timestamptz;
begin
  select full_name into nm from public.profiles where id = p_user and active and role = 'ma';
  if nm is null then return jsonb_build_object('status', 'blocked'); end if;
  first := coalesce(nullif(split_part(nm, ' ', 1), ''), 'du');

  select greatest(max(start_at), max(coalesce(end_at, start_at))) into last_ts
    from public.time_entries where user_id = p_user;
  if last_ts is not null and v_now - last_ts < interval '60 seconds' then
    return jsonb_build_object('status', 'dup', 'name', first);
  end if;

  today_start := date_trunc('day', v_now at time zone 'Europe/Berlin') at time zone 'Europe/Berlin';
  select * into e from public.time_entries where user_id = p_user and end_at is null;
  if found then
    if e.start_at < today_start then
      return jsonb_build_object('status', 'stale', 'name', first, 'entry_id', e.id);
    end if;
    if e.break_start is not null then
      e.break_min := e.break_min + greatest(1, round(extract(epoch from (v_now - e.break_start)) / 60)::int);
    end if;
    work_min := extract(epoch from (v_now - e.start_at)) / 60 - e.break_min;
    if p_source = 'Tablet-NFC' and e.break_min = 0 and work_min > 360 then e.break_min := 30; end if;
    update public.time_entries set end_at = v_now, break_min = e.break_min, break_start = null
      where id = e.id returning * into e;
    return jsonb_build_object('status', 'out', 'entry_id', e.id, 'name', first,
      'start', e.start_at, 'end', e.end_at, 'break_min', e.break_min,
      'net_min', round(extract(epoch from (e.end_at - e.start_at)) / 60 - e.break_min));
  end if;

  insert into public.time_entries (user_id, start_at, source, created_by)
    values (p_user, v_now, p_source, auth.uid()) returning * into e;
  return jsonb_build_object('status', 'in', 'entry_id', e.id, 'name', first, 'start', e.start_at);
end $$;

-- Kern: Pause starten oder beenden
create function public.do_break(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e public.time_entries; v_now timestamptz := now();
begin
  select * into e from public.time_entries where user_id = p_user and end_at is null;
  if not found then raise exception 'Nicht eingestempelt'; end if;
  if e.break_start is null then
    update public.time_entries set break_start = v_now where id = e.id;
    return jsonb_build_object('status', 'break_start');
  end if;
  update public.time_entries
     set break_min = break_min + greatest(1, round(extract(epoch from (v_now - break_start)) / 60)::int),
         break_start = null
   where id = e.id returning * into e;
  return jsonb_build_object('status', 'break_end', 'break_min', e.break_min);
end $$;

-- Mitarbeiterin am eigenen Handy
create function public.self_stamp(p_source text default 'Handy') returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'ma' then raise exception 'Nicht erlaubt'; end if;
  if p_source not in ('Handy','Tablet') then raise exception 'Ungültige Quelle'; end if;
  return public.do_stamp(auth.uid(), p_source);
end $$;

create function public.self_break() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'ma' then raise exception 'Nicht erlaubt'; end if;
  return public.do_break(auth.uid());
end $$;

-- Pause nach dem Ausstempeln anpassen (nur 15 Minuten lang)
create function public.self_set_break(p_entry uuid, p_min int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'ma' then raise exception 'Nicht erlaubt'; end if;
  if p_min not between 0 and 60 then raise exception 'Ungültige Pause'; end if;
  update public.time_entries set break_min = p_min
   where id = p_entry and user_id = auth.uid() and end_at > now() - interval '15 minutes';
  if not found then raise exception 'Eintrag nicht mehr änderbar'; end if;
end $$;

-- Chefin stempelt für die Mitarbeiterin
create function public.stamp_for(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_chef() then raise exception 'Nur die Chefin'; end if;
  return public.do_stamp(p_user, 'Chefin');
end $$;

create function public.break_for(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_chef() then raise exception 'Nur die Chefin'; end if;
  return public.do_break(p_user);
end $$;

-- Tablet: das Tablet hat ein eigenes Konto (Rolle "kiosk") und darf nur diese beiden Funktionen nutzen
create function public.kiosk_stamp(p_tag text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.nfc_tags; r jsonb;
begin
  if public.my_role() is distinct from 'kiosk' then raise exception 'Nicht erlaubt'; end if;
  select * into t from public.nfc_tags where uid_hash = p_tag;
  if not found then
    insert into public.audit_log (actor, actor_name, tbl, op, new_row)
    values (auth.uid(), 'Tablet', 'nfc_tags', 'UNKNOWN', jsonb_build_object('tag', left(p_tag, 8)));
    return jsonb_build_object('status', 'unknown');
  end if;
  if not t.active then
    insert into public.audit_log (actor, actor_name, tbl, op, row_id, new_row)
    values (auth.uid(), 'Tablet', 'nfc_tags', 'BLOCKED', t.id::text, jsonb_build_object('label', t.label));
    return jsonb_build_object('status', 'blocked');
  end if;
  r := public.do_stamp(t.user_id, 'Tablet-NFC');
  if r ->> 'status' in ('in', 'out') then
    update public.nfc_tags set last_used = now() where id = t.id;
  end if;
  return r;
end $$;

create function public.kiosk_set_break(p_entry uuid, p_min int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'kiosk' then raise exception 'Nicht erlaubt'; end if;
  if p_min not between 0 and 60 then raise exception 'Ungültige Pause'; end if;
  update public.time_entries set break_min = p_min
   where id = p_entry and source = 'Tablet-NFC' and end_at > now() - interval '15 minutes';
  if not found then raise exception 'Eintrag nicht mehr änderbar'; end if;
end $$;

-- ============================================================
-- 6. Chefin entscheidet über Anträge
-- ============================================================
create function public.decide_request(p_id uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r public.change_requests; s timestamptz; en timestamptz;
begin
  if not public.is_chef() then raise exception 'Nur die Chefin'; end if;
  select * into r from public.change_requests where id = p_id and status = 'pending';
  if not found then raise exception 'Antrag nicht gefunden'; end if;
  if p_ok then
    s  := (r.work_date + r.start_time) at time zone 'Europe/Berlin';
    en := (r.work_date + r.end_time)   at time zone 'Europe/Berlin';
    if r.entry_id is not null then
      update public.time_entries set start_at = s, end_at = en, break_min = r.break_min,
             break_start = null, note = 'korrigiert' where id = r.entry_id;
    else
      insert into public.time_entries (user_id, start_at, end_at, break_min, source, created_by)
        values (r.user_id, s, en, r.break_min, 'Nachtrag', auth.uid());
    end if;
  end if;
  update public.change_requests
     set status = case when p_ok then 'ok' else 'no' end, decided_at = now(), decided_by = auth.uid()
   where id = p_id;
end $$;

-- ============================================================
-- 7. Automatische Löschung nach Ablauf der Aufbewahrungsfrist
-- ============================================================
create function public.purge_old() returns int
language plpgsql security definer set search_path = public as $$
declare yrs int; n int;
begin
  select retention_years into yrs from public.settings where id = 1;
  perform set_config('app.purge', 'on', true);
  delete from public.change_requests where created_at < now() - make_interval(years => yrs);
  delete from public.time_entries    where start_at   < now() - make_interval(years => yrs);
  get diagnostics n = row_count;
  delete from public.absences        where created_at < now() - make_interval(years => yrs);
  delete from public.audit_log       where ts         < now() - make_interval(years => yrs);
  return n;
end $$;

-- ============================================================
-- 8. Nur die gewollten Funktionen sind von außen aufrufbar
-- ============================================================
revoke all on function
  public.my_role(), public.is_chef(), public.handle_new_user(), public.profiles_guard(), public.audit_trg(),
  public.absences_guard(), public.do_stamp(uuid, text), public.do_break(uuid),
  public.self_stamp(text), public.self_break(), public.self_set_break(uuid, int),
  public.stamp_for(uuid), public.break_for(uuid),
  public.kiosk_stamp(text), public.kiosk_set_break(uuid, int),
  public.decide_request(uuid, boolean), public.purge_old()
from public, anon, authenticated;

grant execute on function
  public.my_role(), public.is_chef(),
  public.self_stamp(text), public.self_break(), public.self_set_break(uuid, int),
  public.stamp_for(uuid), public.break_for(uuid),
  public.kiosk_stamp(text), public.kiosk_set_break(uuid, int),
  public.decide_request(uuid, boolean)
to authenticated;

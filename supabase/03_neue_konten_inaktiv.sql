-- Nachrüsten für Datenbanken, die schon mit der ersten Fassung von schema.sql angelegt wurden:
-- Neue Konten sind ab jetzt zunächst deaktiviert und bekommen erst Zugriff, wenn die Chefin sie
-- unter Einstellungen > Personen aktiviert. Bestehende Konten ändern sich nicht.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, active)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''), false);
  return new;
end $$;

-- Kontrolle: zeigt alle Konten. Chefin und Tablet müssen "active = true" haben.
select email, role, full_name, active from public.profiles order by role;

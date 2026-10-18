\set ON_ERROR_STOP 0
create table results(name text, ok boolean);
create function rec(n text, o boolean) returns void language sql security definer as $$ insert into results values (n, o) $$;
grant execute on function rec(text,boolean) to public;
create function ck(n text, c boolean) returns void language sql as $$ select rec(n, coalesce(c,false)) $$;
create function must_fail(n text, q text) returns void language plpgsql as $$
begin begin execute q; perform rec(n,false); exception when others then perform rec(n,true); end; end $$;
create function affected(q text) returns int language plpgsql as $$ declare n int; begin execute q; get diagnostics n=row_count; return n; end $$;
create function as_u(u uuid, aal text default 'aal1', r text default 'authenticated') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when u is null then '{}' else json_build_object('sub',u,'role',r,'aal',aal)::text end, true);
  execute format('set local role %I', r);
end $$;

insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000c','chef@x','{"full_name":"Elisabeth Roßner"}'),
 ('00000000-0000-0000-0000-0000000000a1','ma@x','{"full_name":"Lena Bauer"}'),
 ('00000000-0000-0000-0000-0000000000a2','ma2@x','{"full_name":"Zweite Person"}'),
 ('00000000-0000-0000-0000-0000000000f1','tab@x','{"full_name":"Tablet"}');
update profiles set role='chef' where id='00000000-0000-0000-0000-00000000000c';
update profiles set role='kiosk' where id='00000000-0000-0000-0000-0000000000f1';
insert into time_entries(user_id,start_at,end_at,break_min,source) values ('00000000-0000-0000-0000-0000000000a2', now()-interval '2 days', now()-interval '2 days'+interval '5 hours',30,'Handy');
insert into nfc_tags(uid_hash,label,user_id) values ('hashA','Tag Lena','00000000-0000-0000-0000-0000000000a1');
select ck('Profil bekommt E-Mail', (select email='ma@x' from profiles where id='00000000-0000-0000-0000-0000000000a1'));

-- Mitarbeiterin
begin; select as_u('00000000-0000-0000-0000-0000000000a1');
 select must_fail('MA direkter Insert in Zeiten', $q$insert into time_entries(user_id,source) values ('00000000-0000-0000-0000-0000000000a1','Handy')$q$);
 select ck('MA sieht nichts Fremdes', (select count(*)=0 from time_entries));
 select ck('MA stempelt ein', (self_stamp('Handy')->>'status')='in');
 select ck('MA Doppelstempel', (self_stamp('Handy')->>'status')='dup');
 select must_fail('MA falsche Quelle', $q$select self_stamp('Chefin')$q$);
 select ck('MA Pause beginnt', (self_break()->>'status')='break_start');
 select ck('MA Pause endet', (self_break()->>'status')='break_end');
 select ck('MA sieht eigenen Eintrag', (select count(*)=1 from time_entries));
 select ck('MA Update wirkungslos', affected($q$update time_entries set break_min=99$q$)=0);
 select must_fail('MA stamp_for', $q$select stamp_for('00000000-0000-0000-0000-0000000000a2')$q$);
 select must_fail('MA kiosk_stamp', $q$select kiosk_stamp('hashA')$q$);
 select must_fail('MA decide_request', $q$select decide_request(gen_random_uuid(), true)$q$);
 select must_fail('MA purge_old', $q$select purge_old()$q$);
 select must_fail('MA do_stamp direkt', $q$select do_stamp('00000000-0000-0000-0000-0000000000a2','Handy')$q$);
 select ck('MA Audit unsichtbar', (select count(*)=0 from audit_log));
 select ck('MA Rolle nicht änderbar', affected($q$update profiles set role='chef' where id=auth.uid()$q$)=0);
 select ck('MA Einstellungen unveränderbar', affected($q$update settings set wage=99$q$)=0);
 select ck('MA sieht Einstellungen', (select count(*)=1 from settings));
 select ck('MA sieht Betriebsferien', (select count(*)=1 from closures));
 select must_fail('MA Absence mit ok', $q$insert into absences(user_id,type,date_from,date_to,status) values ('00000000-0000-0000-0000-0000000000a1','krank',current_date,current_date,'ok')$q$);
 select must_fail('MA Absence für andere', $q$insert into absences(user_id,type,date_from,date_to) values ('00000000-0000-0000-0000-0000000000a2','krank',current_date,current_date)$q$);
 insert into absences(user_id,type,date_from,date_to,note) values ('00000000-0000-0000-0000-0000000000a1','krank',current_date,current_date,'Arzt');
 select must_fail('MA Absence Typ ändern', $q$update absences set type='urlaub'$q$);
 select ck('MA zieht Absence zurück', affected($q$update absences set status='no'$q$)=1);
 select ck('MA Absence Grund gesetzt', (select why='Zurückgezogen' from absences));
 insert into change_requests(user_id,work_date,start_time,end_time,break_min,reason) values ('00000000-0000-0000-0000-0000000000a1',current_date-1,'06:00','11:00',0,'Vergessen');
 select must_fail('MA Antrag mit ok', $q$insert into change_requests(user_id,work_date,start_time,end_time,reason,status) values ('00000000-0000-0000-0000-0000000000a1',current_date-2,'06:00','11:00','Test','ok')$q$);
 select ck('MA Antrag nicht selbst genehmigen', affected($q$update change_requests set status='ok'$q$)=0);
commit;
reset role;

-- Zeit vergeht: Ausstempeln und Pause nachträglich anpassen
update time_entries set start_at=now()-interval '5 hours', break_min=0, break_start=null where user_id='00000000-0000-0000-0000-0000000000a1' and end_at is null;
begin; select as_u('00000000-0000-0000-0000-0000000000a1');
 select ck('MA stempelt aus', (select (r->>'status')='out' and (r->>'break_min')::int=0 from (select self_stamp('Handy') r) x));
 select self_set_break((select id from time_entries limit 1), 30);
 select ck('MA Pause nachträglich', (select break_min=30 from time_entries));
commit;
reset role;
update time_entries set end_at=now()-interval '20 minutes', start_at=now()-interval '6 hours' where user_id='00000000-0000-0000-0000-0000000000a1';
begin; select as_u('00000000-0000-0000-0000-0000000000a1');
 select must_fail('MA Pause nach 15 Minuten gesperrt', $q$select self_set_break((select id from time_entries limit 1), 10)$q$);
commit;
reset role;

-- Chefin ohne Authenticator (aal1)
begin; select as_u('00000000-0000-0000-0000-00000000000c','aal1');
 select ck('Chef aal1 sieht Rolle', (select my_role()='chef'));
 select ck('Chef aal1 sieht keine fremden Zeiten', (select count(*)=0 from time_entries));
 select must_fail('Chef aal1 stamp_for', $q$select stamp_for('00000000-0000-0000-0000-0000000000a1')$q$);
 select ck('Chef aal1 Einstellungen wirkungslos', affected($q$update settings set wage=50$q$)=0);
 select ck('Chef aal1 sieht kein Audit', (select count(*)=0 from audit_log));
commit;

-- Chefin mit Authenticator (aal2)
begin; select as_u('00000000-0000-0000-0000-00000000000c','aal2');
 select ck('Chef sieht alle Zeiten', (select count(*)>=2 from time_entries));
 select ck('Chef sieht Audit', (select count(*)>3 from audit_log));
 select ck('Chef sieht alle Profile', (select count(*)=4 from profiles));
 select decide_request((select id from change_requests limit 1), true);
 select ck('Antrag wurde Nachtrag', (select count(*)=1 from time_entries where source='Nachtrag'));
 select ck('Chef ändert Einstellungen', affected($q$update settings set wage=14.5$q$)=1);
 select must_fail('Chef kein Löschen von Zeiten', $q$delete from time_entries$q$);
 select must_fail('Chef Rolle über App ändern', $q$update profiles set role='chef' where id='00000000-0000-0000-0000-0000000000a1'$q$);
 select ck('Chef Name ändern', affected($q$update profiles set full_name='Lena B.' where id='00000000-0000-0000-0000-0000000000a1'$q$)=1);
 select ck('Chef stempelt für MA ein', (stamp_for('00000000-0000-0000-0000-0000000000a1')->>'status')='in');
 select ck('Chef Tag anlegen', affected($q$insert into nfc_tags(uid_hash,label,user_id) values ('hashB','Zweiter','00000000-0000-0000-0000-0000000000a2')$q$)=1);
 select ck('Chef schreibt Zeiten', affected($q$insert into time_entries(user_id,start_at,end_at,source) values ('00000000-0000-0000-0000-0000000000a2',now()-interval '9 days',now()-interval '9 days'+interval '4 hours','Nachtrag')$q$)=1);
 select ck('Chef bestätigt Absence', affected($q$update absences set status='ok'$q$)=1);
commit;
reset role;
update time_entries set start_at=now()-interval '1 day', end_at=now()-interval '1 day'+interval '4 hours' where user_id='00000000-0000-0000-0000-0000000000a1' and end_at is null;

-- Tablet
begin; select as_u('00000000-0000-0000-0000-0000000000f1');
 select ck('Kiosk unbekannter Tag', (kiosk_stamp('nope')->>'status')='unknown');
 select ck('Kiosk Einstempeln', (kiosk_stamp('hashA')->>'status')='in');
 select ck('Kiosk Doppelstempel', (kiosk_stamp('hashA')->>'status')='dup');
 select ck('Kiosk sieht keine Zeiten', (select count(*)=0 from time_entries));
 select ck('Kiosk sieht keine Einstellungen', (select count(*)=0 from settings));
 select must_fail('Kiosk direkter Insert', $q$insert into time_entries(user_id,source) values ('00000000-0000-0000-0000-0000000000a1','Tablet-NFC')$q$);
 select must_fail('Kiosk self_stamp', $q$select self_stamp('Tablet')$q$);
 select must_fail('Kiosk liest Tags', $q$select 1/(select count(*) from nfc_tags)$q$);
commit;
reset role;
update time_entries set start_at=now()-interval '7 hours' where end_at is null;
begin; select as_u('00000000-0000-0000-0000-0000000000f1');
 select ck('Kiosk Ausstempeln mit Auto-Pause', (select (r->>'status')='out' and (r->>'break_min')::int=30 from (select kiosk_stamp('hashA') r) x));
 select kiosk_set_break((select id from time_entries limit 0), 15) where false;
commit;
reset role;
update nfc_tags set active=false where uid_hash='hashA';
begin; select as_u('00000000-0000-0000-0000-0000000000f1');
 select ck('Kiosk gesperrter Tag', (kiosk_stamp('hashA')->>'status')='blocked');
commit;
reset role;
-- Stale: offener Eintrag von gestern
update nfc_tags set active=true where uid_hash='hashA';
insert into time_entries(user_id,start_at,source) values ('00000000-0000-0000-0000-0000000000a2', now()-interval '30 hours','Handy');
insert into nfc_tags(uid_hash,label,user_id) values ('hashC','Tag2','00000000-0000-0000-0000-0000000000a2') on conflict do nothing;
begin; select as_u('00000000-0000-0000-0000-0000000000f1');
 select ck('Kiosk Stale', (kiosk_stamp('hashC')->>'status')='stale');
commit;
reset role;

-- anon
begin; select as_u(null,'aal1','anon');
 select must_fail('anon liest Zeiten', $q$select * from time_entries$q$);
 select must_fail('anon kiosk_stamp', $q$select kiosk_stamp('x')$q$);
 select must_fail('anon self_stamp', $q$select self_stamp('Handy')$q$);
 select must_fail('anon liest Settings', $q$select * from settings$q$);
commit;
reset role;
select ck('Audit enthält Stempel', (select count(*)>5 from audit_log where tbl='time_entries'));
select ck('purge_old läuft', (select purge_old() >= 0));
select name, case when ok then 'ok' else '*** FEHLER ***' end from results where not ok;
select count(*) filter (where ok) || ' von ' || count(*) || ' bestanden' from results;

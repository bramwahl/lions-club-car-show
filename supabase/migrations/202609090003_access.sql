-- Phase 1B roles and access; no imported field values or score/award formulas change.
alter table public.profiles add column app_role text check (app_role in ('admin','judge'));
alter table public.profiles add column is_active boolean not null default false;
alter table public.events add column judging_open boolean not null default false;
alter table public.events add column public_visible boolean not null default false;
alter table public.events add column results_public boolean not null default false;
create unique index one_open_judging_event on public.events(judging_open) where judging_open;
alter table public.score_history add column request_id uuid unique;

create function public.current_app_role() returns text
language sql stable security definer set search_path = '' as $$
  select p.app_role from public.profiles p
  where p.id = auth.uid() and p.is_active and p.app_role in ('admin','judge');
$$;
revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

-- All raw business-table reads are Admin-only. Judge/Public use narrow projections.
grant select on public.events, public.participants, public.cars, public.event_registrations,
  public.scores, public.score_history, public.profiles to authenticated;
create policy events_admin_read on public.events for select to authenticated using ((select public.current_app_role())='admin');
create policy participants_admin_read on public.participants for select to authenticated using ((select public.current_app_role())='admin');
create policy cars_admin_read on public.cars for select to authenticated using ((select public.current_app_role())='admin');
create policy registrations_admin_read on public.event_registrations for select to authenticated using ((select public.current_app_role())='admin');
create policy scores_admin_read on public.scores for select to authenticated using ((select public.current_app_role())='admin');
create policy history_admin_read on public.score_history for select to authenticated using ((select public.current_app_role())='admin');
create policy profiles_self_or_admin_read on public.profiles for select to authenticated
  using (id=(select auth.uid()) or (select public.current_app_role())='admin');

-- Explicit Admin-managed columns; legacy IDs, allocator, score/history and profile writes stay denied.
grant insert(id,name,slug,event_year,event_date,timezone_name) on public.events to authenticated;
grant update(name,slug,event_year,event_date,timezone_name,judging_open,public_visible,results_public) on public.events to authenticated;
grant delete on public.events to authenticated;
grant insert(id,name,email,phone,address,city,state,zip) on public.participants to authenticated;
grant update(name,email,phone,address,city,state,zip) on public.participants to authenticated;
grant delete on public.participants to authenticated;
grant insert(id,participant_id,year,make,model,notes) on public.cars to authenticated;
grant update(participant_id,year,make,model,notes) on public.cars to authenticated;
grant delete on public.cars to authenticated;
grant update(status,payment_status,classification) on public.event_registrations to authenticated;
create policy events_admin_insert on public.events for insert to authenticated with check ((select public.current_app_role())='admin');
create policy events_admin_update on public.events for update to authenticated using ((select public.current_app_role())='admin') with check ((select public.current_app_role())='admin');
create policy events_admin_delete on public.events for delete to authenticated using ((select public.current_app_role())='admin' and legacy_source_key is null);
create policy participants_admin_insert on public.participants for insert to authenticated with check ((select public.current_app_role())='admin');
create policy participants_admin_update on public.participants for update to authenticated using ((select public.current_app_role())='admin') with check ((select public.current_app_role())='admin');
create policy participants_admin_delete on public.participants for delete to authenticated using ((select public.current_app_role())='admin' and legacy_participant_id is null);
create policy cars_admin_insert on public.cars for insert to authenticated with check ((select public.current_app_role())='admin');
create policy cars_admin_update on public.cars for update to authenticated using ((select public.current_app_role())='admin') with check ((select public.current_app_role())='admin');
create policy cars_admin_delete on public.cars for delete to authenticated using ((select public.current_app_role())='admin' and legacy_car_id is null);
create policy registrations_admin_update on public.event_registrations for update to authenticated using ((select public.current_app_role())='admin') with check ((select public.current_app_role())='admin');

create function car_show_private.require_staff(p_admin boolean default false) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare actor public.profiles;
begin
  select * into actor from public.profiles where id=auth.uid() and is_active for share;
  if actor.id is null or actor.app_role is null or actor.app_role not in ('admin','judge') or (p_admin and actor.app_role<>'admin') then
    raise exception 'Access denied' using errcode='42501';
  end if;
  if actor.display_name is null or btrim(actor.display_name)='' then raise exception 'Staff display name required' using errcode='42501'; end if;
  return actor;
end $$;
revoke all on function car_show_private.require_staff(boolean) from public, anon, authenticated;

create function car_show_private.guard_legacy_event_access() returns trigger
language plpgsql set search_path = '' as $$
begin
  if NEW.judging_open and NEW.legacy_source_key is not null then
    raise exception 'Legacy snapshot is closed to new judging' using errcode='23514';
  end if;
  return NEW;
end $$;
create trigger legacy_event_judging_guard before insert or update on public.events
for each row execute function car_show_private.guard_legacy_event_access();
revoke all on function car_show_private.guard_legacy_event_access() from public, anon, authenticated;

create function public.admin_set_account(p_user_id uuid,p_role text,p_active boolean,p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor public.profiles; previous public.profiles;
begin
  actor := car_show_private.require_staff(true);
  if p_role is null or p_role not in ('admin','judge') or p_active is null or p_name is null or length(btrim(p_name)) not between 2 and 80 then
    raise exception 'Invalid account fields' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(20250907,2);
  select * into previous from public.profiles where id=p_user_id for update;
  if previous.app_role='admin' and previous.is_active and (p_role<>'admin' or not p_active)
    and (select count(*) from public.profiles where app_role='admin' and is_active)<=1 then
    raise exception 'Keep at least one active Admin' using errcode='23514';
  end if;
  insert into public.profiles(id,display_name,app_role,is_active) values(p_user_id,btrim(p_name),p_role,p_active)
    on conflict(id) do update set display_name=excluded.display_name,app_role=excluded.app_role,is_active=excluded.is_active;
end $$;
create function public.admin_accounts() returns table(id uuid,email text,display_name text,app_role text,is_active boolean)
language plpgsql security definer set search_path = '' as $$
begin
  perform car_show_private.require_staff(true);
  return query select p.id,u.email::text,p.display_name,p.app_role,p.is_active
    from public.profiles p join auth.users u on u.id=p.id
    where p.app_role in ('admin','judge') order by p.display_name,p.id;
end $$;
create function public.admin_register_car(p_event_id uuid,p_car_id uuid) returns public.event_registrations
language plpgsql security definer set search_path = '' as $$
begin
  perform car_show_private.require_staff(true);
  if not exists(select 1 from public.events where id=p_event_id and legacy_source_key is null) then
    raise exception 'Registration is unavailable' using errcode='42501';
  end if;
  return car_show_private.register_car(p_event_id,p_car_id);
end $$;

create function public.judge_event() returns table(id uuid,name text,event_year smallint,event_date date,timezone_name text)
language plpgsql security definer set search_path = '' as $$
begin
  perform car_show_private.require_staff();
  return query select e.id,e.name,e.event_year,e.event_date,e.timezone_name from public.events e where e.judging_open and e.legacy_source_key is null;
end $$;
create function public.judge_registrations(p_car_number text default null)
returns table(id uuid,car_number text,vehicle_year smallint,vehicle_make text,vehicle_model text,classification text,status text,progress_percentage numeric)
language plpgsql security definer set search_path = '' as $$
begin
  perform car_show_private.require_staff();
  if p_car_number is not null and p_car_number !~ '^[0-9]{1,19}$' then raise exception 'Invalid car number' using errcode='22023'; end if;
  return query select r.id,r.car_number::text,r.vehicle_year,r.vehicle_make::text,r.vehicle_model::text,r.classification::text,r.status::text,s.progress_percentage
    from public.event_registrations r join public.events e on e.id=r.event_id
    left join public.scores s on s.event_registration_id=r.id
    where e.judging_open and e.legacy_source_key is null and (p_car_number is null or r.car_number::text=p_car_number)
    order by r.car_number limit 50;
end $$;
create function public.judge_score(p_registration_id uuid) returns setof public.scores
language plpgsql security definer set search_path = '' as $$
begin
  perform car_show_private.require_staff();
  return query select s.* from public.scores s join public.event_registrations r on r.id=s.event_registration_id
    join public.events e on e.id=r.event_id where r.id=p_registration_id and e.judging_open and e.legacy_source_key is null;
end $$;
create function public.judge_history(p_registration_id uuid)
returns table(id uuid,action_type text,section text,judge_name text,submitted_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform car_show_private.require_staff();
  return query select h.id,h.action_type,h.section,h.judge_name_snapshot,h.submitted_at
    from public.score_history h join public.scores s on s.id=h.score_id
    join public.event_registrations r on r.id=s.event_registration_id join public.events e on e.id=r.event_id
    where r.id=p_registration_id and e.judging_open and e.legacy_source_key is null order by h.submitted_at desc limit 100;
end $$;

-- Explicitly published projections only. No participant joins, IDs or contact fields.
create function public.public_events() returns table(slug text,name text,event_year smallint,event_date date)
language sql stable security definer set search_path = '' as $$
  select e.slug,e.name,e.event_year,e.event_date from public.events e where e.public_visible order by e.event_year desc limit 50;
$$;
create function public.public_results(p_event_slug text)
returns table(car_number text,vehicle_year smallint,vehicle_make text,vehicle_model text,classification text,total_score integer,overall_paint integer,overall_interior integer,overall_engine integer)
language sql stable security definer set search_path = '' as $$
  select r.car_number::text,r.vehicle_year,r.vehicle_make::text,r.vehicle_model::text,r.classification::text,s.total_score,s.overall_paint,s.overall_interior,s.overall_engine
    from public.events e join public.event_registrations r on r.event_id=e.id join public.scores s on s.event_registration_id=r.id
    where e.slug=p_event_slug and e.public_visible and e.results_public;
$$;

revoke all on function public.admin_set_account(uuid,text,boolean,text),public.admin_accounts(),public.admin_register_car(uuid,uuid),
  public.judge_event(),public.judge_registrations(text),public.judge_score(uuid),public.judge_history(uuid),public.public_events(),public.public_results(text) from public,anon,authenticated;
grant execute on function public.admin_set_account(uuid,text,boolean,text),public.admin_accounts(),public.admin_register_car(uuid,uuid),
  public.judge_event(),public.judge_registrations(text),public.judge_score(uuid),public.judge_history(uuid) to authenticated;
grant execute on function public.public_events(),public.public_results(text) to anon,authenticated;

-- Public pre-registration. Additive; activation is a separate Admin operation.
create table car_show_private.registration_portal (
 singleton boolean primary key default true check(singleton), event_id uuid references public.events(id), secret_hash text not null
);
create table car_show_private.registration_attempts (client_key text not null, at timestamptz not null default now());
create index on car_show_private.registration_attempts(client_key,at);
create table car_show_private.registration_matches (
 token uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id),
 participant_id uuid not null references public.participants(id), expires_at timestamptz not null default now()+interval '20 minutes'
);
create table public.registration_requests (
 id uuid primary key, event_id uuid not null references public.events(id), participant_id uuid references public.participants(id),
 details jsonb not null, cars jsonb not null, status text not null default 'Pending' check(status in ('Pending','Accepted','Dismissed')),
 created_at timestamptz not null default now(), reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_name text, reviewed_at timestamptz, payload_hash text not null
);
alter table public.registration_requests enable row level security;
revoke all on public.registration_requests from public,anon,authenticated;
revoke all on car_show_private.registration_portal,car_show_private.registration_attempts,car_show_private.registration_matches from public,anon,authenticated;

create function public.admin_registration_portal(p_event uuid,p_hash text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform car_show_private.require_staff(true);
 perform 1 from car_show_private.registration_portal where singleton for update;
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid portal configuration'; end if;
 if p_event is not null then
  perform 1 from public.events where id=p_event and legacy_source_key is null for update;
  if not found then raise exception 'Choose a nonhistorical event'; end if;
 end if;
 insert into car_show_private.registration_portal(singleton,event_id,secret_hash) values(true,p_event,p_hash)
 on conflict(singleton) do update set event_id=excluded.event_id,secret_hash=excluded.secret_hash;
end $$;

-- Called only by the application server with a dedicated portal secret, never an Auth service key.
create function public.registration_portal(p_secret text,p_client text,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg car_show_private.registration_portal; person uuid; matches integer; tok uuid; car uuid; request_id uuid; existing public.registration_requests;
 fingerprint text; item jsonb; ids uuid[]; selected uuid[]:='{}'; details jsonb; new_cars jsonb; event_name text;
begin
 select * into cfg from car_show_private.registration_portal where singleton for share;
 if cfg.event_id is null or p_secret is null or cfg.secret_hash<>encode(sha256(convert_to(p_secret,'UTF8')),'hex') then return '{"error":"Registration is not open yet."}'::jsonb; end if;
 select name into event_name from public.events where id=cfg.event_id and legacy_source_key is null;
 if event_name is null then return '{"error":"Registration is not open yet."}'::jsonb; end if;
 if p_action='event' then return jsonb_build_object('id',cfg.event_id,'name',event_name); end if;
 if p_client is null or p_client !~ '^[0-9a-f]{64}$' then return '{"error":"Please try again later."}'::jsonb; end if;
 -- Serialize counters; failures return normally so attempt counters are committed.
 perform pg_advisory_xact_lock(713024);
 delete from car_show_private.registration_attempts where at<now()-interval '1 hour';
 if (select count(*) from car_show_private.registration_attempts where client_key=p_client and at>now()-interval '10 minutes')>=20
 or (select count(*) from car_show_private.registration_attempts where at>now()-interval '10 minutes')>=200 then return '{"error":"Please try again later or visit the check-in table."}'::jsonb; end if;
 insert into car_show_private.registration_attempts(client_key) values(p_client);
 delete from car_show_private.registration_matches where expires_at<now();
 if p_action='lookup' then
  if length(coalesce(p_data->>'name','')) not between 2 and 255 or length(coalesce(p_data->>'contact','')) not between 5 and 255 then return '{"matched":false}'::jsonb; end if;
  select count(*),(array_agg(id))[1] into matches,person from public.participants
  where lower(btrim(name))=lower(btrim(p_data->>'name')) and
   ((position('@' in p_data->>'contact')>0 and lower(btrim(email))=lower(btrim(p_data->>'contact')))
    or (length(regexp_replace(p_data->>'contact','[^0-9]','','g'))>=7 and regexp_replace(phone,'[^0-9]','','g')=regexp_replace(p_data->>'contact','[^0-9]','','g')));
  if matches<>1 then return '{"matched":false}'::jsonb; end if;
  insert into car_show_private.registration_matches(event_id,participant_id) values(cfg.event_id,person) returning token into tok;
  return jsonb_build_object('matched',true,'token',tok,'cars',coalesce((select jsonb_agg(jsonb_build_object('id',id,'year',year,'make',make,'model',model)) from public.cars where participant_id=person),'[]'::jsonb));
 elsif p_action='submit' then
  begin
   if (p_data->>'event')::uuid is distinct from cfg.event_id then return '{"error":"The registration event changed. Reload this page before submitting."}'::jsonb; end if;
   request_id:=(p_data->>'request')::uuid;
   if request_id is null then raise exception 'request'; end if;
   details:=p_data->'details'; new_cars:=p_data->'cars';
   if jsonb_typeof(details) is distinct from 'object' or jsonb_typeof(new_cars) is distinct from 'array' or jsonb_typeof(p_data->'selected') is distinct from 'array' then raise exception 'shape'; end if;
   if jsonb_array_length(new_cars)>10 or jsonb_array_length(p_data->'selected')>10 then raise exception 'count'; end if;
   if p_data->>'token' is not null then
    select participant_id into person from car_show_private.registration_matches where token=(p_data->>'token')::uuid and event_id=cfg.event_id and expires_at>now();
    if person is null then return '{"error":"Your match expired. Please find your record again."}'::jsonb; end if;
   end if;
   if person is null and (length(btrim(coalesce(details->>'name',''))) not between 2 and 255) then raise exception 'name'; end if;
   if length(details::text)>5000 then raise exception 'details'; end if;
   for item in select value from jsonb_array_elements(new_cars) loop
    if coalesce(item->>'year','') !~ '^[0-9]{4}$' or (item->>'year')::int not between 1901 and 2155 or length(btrim(coalesce(item->>'make',''))) not between 1 and 255 or length(btrim(coalesce(item->>'model',''))) not between 1 and 255 then raise exception 'car'; end if;
   end loop;
   for car in select value::uuid from jsonb_array_elements_text(p_data->'selected') loop
    if person is null or not exists(select 1 from public.cars where id=car and participant_id=person) then raise exception 'ownership'; end if;
    if exists(select 1 from public.event_registrations where event_id=cfg.event_id and car_id=car and status not in ('Registered','Checked-in','Judged')) then raise exception 'Please visit staff for this car'; end if;
    if not car=any(selected) then selected:=array_append(selected,car); end if;
   end loop;
   if cardinality(selected)+jsonb_array_length(new_cars)=0 then raise exception 'empty'; end if;
   fingerprint:=encode(sha256(convert_to(p_data::text,'UTF8')),'hex');
   select * into existing from public.registration_requests where id=request_id;
   if found then
    if existing.payload_hash<>fingerprint or existing.event_id<>cfg.event_id then raise exception 'reused'; end if;
    return jsonb_build_object('ok',true,'pending',existing.status='Pending');
   end if;
   -- Existing cars can pre-register immediately. Never modify an existing registration.
   perform 1 from public.events where id=cfg.event_id for update;
   foreach car in array selected loop
    if not exists(select 1 from public.event_registrations where event_id=cfg.event_id and car_id=car) then perform car_show_private.preregister_car(cfg.event_id,car); end if;
   end loop;
   insert into public.registration_requests(id,event_id,participant_id,details,cars,status,payload_hash)
   values(request_id,cfg.event_id,person,details,new_cars,case when jsonb_array_length(new_cars)>0 then 'Pending' else 'Accepted' end,fingerprint);
   return jsonb_build_object('ok',true,'pending',jsonb_array_length(new_cars)>0);
  exception when others then return '{"error":"Please check your details and selected cars, then try again."}'::jsonb;
  end;
 end if;
 return '{"error":"Invalid request."}'::jsonb;
end $$;

create function public.admin_registration_requests() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform car_show_private.require_staff(true);
 return jsonb_build_object('event',(select event_id from car_show_private.registration_portal where singleton),'requests',coalesce((select jsonb_agg(to_jsonb(r) - 'payload_hash' order by created_at) from public.registration_requests r where status='Pending'),'[]'::jsonb));
end $$;
create function public.admin_review_registration(p_request uuid,p_participant uuid,p_cars uuid[],p_dismiss boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.registration_requests; actor public.profiles; person uuid; car uuid; item jsonb; i integer:=0;
begin
 actor:=car_show_private.require_staff(true);
 select * into strict r from public.registration_requests where id=p_request for update;
 if r.status<>'Pending' then raise exception 'This request has already been reviewed'; end if;
 perform 1 from public.events where id=r.event_id and legacy_source_key is null for update;
 if not found then raise exception 'Historical event is read-only'; end if;
 if p_dismiss then update public.registration_requests set status='Dismissed',reviewed_by=actor.id,reviewed_name=actor.display_name,reviewed_at=now() where id=r.id; return null; end if;
 person:=coalesce(r.participant_id,p_participant);
 if r.participant_id is not null and p_participant is distinct from r.participant_id then raise exception 'Use the matched participant'; end if;
 if person is null then
  insert into public.participants(name,email,phone,city,state) values(r.details->>'name',coalesce(r.details->>'email',''),nullif(r.details->>'phone',''),r.details->>'city',r.details->>'state') returning id into person;
 else perform 1 from public.participants where id=person; if not found then raise exception 'Participant not found'; end if;
 end if;
 if coalesce(cardinality(p_cars),0)<>jsonb_array_length(r.cars) then raise exception 'Choose a vehicle for each requested car'; end if;
 for item in select value from jsonb_array_elements(r.cars) loop
  i:=i+1; car:=p_cars[i];
  if car is null then insert into public.cars(participant_id,year,make,model) values(person,(item->>'year')::int,item->>'make',item->>'model') returning id into car;
  elsif not exists(select 1 from public.cars where id=car and participant_id=person) then raise exception 'Car does not belong to participant'; end if;
  if not exists(select 1 from public.event_registrations where event_id=r.event_id and car_id=car) then perform car_show_private.preregister_car(r.event_id,car); end if;
 end loop;
 update public.registration_requests set status='Accepted',participant_id=person,reviewed_by=actor.id,reviewed_name=actor.display_name,reviewed_at=now() where id=r.id;
 return person;
end $$;
revoke all on function public.admin_registration_portal(uuid,text),public.registration_portal(text,text,text,jsonb),public.admin_registration_requests(),public.admin_review_registration(uuid,uuid,uuid[],boolean) from public,anon,authenticated;
grant execute on function public.admin_registration_portal(uuid,text),public.admin_registration_requests(),public.admin_review_registration(uuid,uuid,uuid[],boolean) to authenticated;
grant execute on function public.registration_portal(text,text,text,jsonb) to anon;

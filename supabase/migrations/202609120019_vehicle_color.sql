-- Local review only: optional current color and event snapshot; no historical backfill.
alter table public.cars add column color text check(length(color)<=80);
alter table public.event_registrations add column vehicle_color text check(length(vehicle_color)<=80);
create or replace function car_show_private.preregister_car(p_event uuid,p_car uuid)
returns public.event_registrations language plpgsql set search_path='' as $$
declare c public.cars; result public.event_registrations;
begin
 perform 1 from public.events where id=p_event and legacy_source_key is null for update;
 if not found then raise exception 'Historical event is read-only' using errcode='42501'; end if;
 select * into strict c from public.cars where id=p_car for share;
 insert into public.event_registrations(event_id,car_id,participant_id,car_number,vehicle_year,vehicle_make,vehicle_model,vehicle_color,classification)
 values(p_event,c.id,c.participant_id,null,c.year,c.make,c.model,c.color,
 case when c.year<1950 then 'Pre-1950' when c.year<1960 then '1950s' when c.year<1970 then '1960s' when c.year<1980 then '1970s' when c.year<1990 then '1980s' when c.year<2000 then '1990s' else 'Post-2000' end) returning * into result;
 return result;
end $$;

create function public.admin_arrival(p_event uuid,p_participant uuid,p_car uuid,p_payment text,p_color text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform car_show_private.require_staff(true);
 if p_color is null or length(btrim(p_color)) not between 1 and 80 then raise exception 'Enter car color' using errcode='22023'; end if;
 perform 1 from public.events where id=p_event and legacy_source_key is null for update;
 if not found then raise exception 'Historical event is read-only'; end if;
 perform 1 from public.cars where id=p_car and participant_id=p_participant for update;
 if not found then raise exception 'Car does not belong to participant'; end if;
 result:=public.admin_arrival(p_event,p_participant,p_car,p_payment);
 update public.cars set color=btrim(p_color) where id=p_car;
 update public.event_registrations set vehicle_color=btrim(p_color) where id=result;
 return result;
end $$;
revoke all on function public.admin_arrival(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_arrival(uuid,uuid,uuid,text,text) to authenticated;
create function car_show_private.protect_historical_color() returns trigger language plpgsql set search_path='' as $$
begin
 if new.vehicle_color is distinct from old.vehicle_color and exists(select 1 from public.events where id=old.event_id and legacy_source_key is not null) then raise exception 'Historical color is immutable'; end if;
 return new;
end $$;
create trigger historical_color before update on public.event_registrations for each row execute function car_show_private.protect_historical_color();
-- Event-day capacity: 300 operations per network and 1500 globally per rolling 10 minutes.
create or replace function public.registration_portal(p_secret text,p_client text,p_action text,p_data jsonb default '{}') returns jsonb
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
 if (select count(*) from car_show_private.registration_attempts where client_key=p_client and at>now()-interval '10 minutes')>=300
 or (select count(*) from car_show_private.registration_attempts where at>now()-interval '10 minutes')>=1500 then return '{"error":"Please try again later or visit the check-in table."}'::jsonb; end if;
 insert into car_show_private.registration_attempts(client_key) values(p_client);
 delete from car_show_private.registration_matches where expires_at<now();
 if p_action='lookup' then
  if length(coalesce(p_data->>'name','')) not between 2 and 255 or length(coalesce(p_data->>'contact','')) not between 5 and 255 then return '{"matched":false}'::jsonb; end if;
  select count(*),(array_agg(id))[1] into matches,person from public.participants
  where (lower(btrim(name))=lower(btrim(p_data->>'name'))
   or lower(regexp_replace(btrim(name),'^.*[[:space:]]',''))=lower(btrim(p_data->>'name'))) and
   ((position('@' in p_data->>'contact')>0 and lower(btrim(email))=lower(btrim(p_data->>'contact')))
    or (length(regexp_replace(p_data->>'contact','[^0-9]','','g'))>=7 and regexp_replace(phone,'[^0-9]','','g')=regexp_replace(p_data->>'contact','[^0-9]','','g')));
  if matches<>1 then
   if matches=0 and exists(select 1 from public.registration_requests r where r.event_id=cfg.event_id and r.status='Pending' and r.participant_id is null
    and (lower(btrim(r.details->>'name'))=lower(btrim(p_data->>'name')) or lower(regexp_replace(btrim(r.details->>'name'),'^.*[[:space:]]',''))=lower(btrim(p_data->>'name')))
    and ((position('@' in p_data->>'contact')>0 and lower(btrim(r.details->>'email'))=lower(btrim(p_data->>'contact')))
     or (length(regexp_replace(p_data->>'contact','[^0-9]','','g'))>=7 and regexp_replace(r.details->>'phone','[^0-9]','','g')=regexp_replace(p_data->>'contact','[^0-9]','','g'))))
   then return '{"matched":false,"pending":true}'::jsonb; end if;
   return '{"matched":false}'::jsonb;
  end if;
  insert into car_show_private.registration_matches(event_id,participant_id) values(cfg.event_id,person) returning token into tok;
  return jsonb_build_object('matched',true,'token',tok,'participant',(select jsonb_build_object('name',name,'city',city,'state',state) from public.participants where id=person),'cars',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'year',c.year,'make',c.make,'model',c.model,'registered',exists(select 1 from public.event_registrations r where r.car_id=c.id and r.event_id=cfg.event_id))) from public.cars c where c.participant_id=person),'[]'::jsonb));
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
    if coalesce(item->>'year','') !~ '^[0-9]{4}$' or (item->>'year')::int not between 1900 and 2155 or length(btrim(coalesce(item->>'make',''))) not between 1 and 255 or length(btrim(coalesce(item->>'model',''))) not between 1 and 255 then raise exception 'car'; end if;
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
   -- New participants are now accepted directly, including shared/blank email.
   if person is null then
    insert into public.participants(name,email,phone,city,state) values(btrim(details->>'name'),coalesce(details->>'email',''),nullif(details->>'phone',''),details->>'city',details->>'state') returning id into person;
   end if;
   -- Matched participants may add and pre-register new cars in the same transaction.
   -- A duplicate request UUID was checked above, so retries never add another car.
   if person is not null then
    for item in select value from jsonb_array_elements(new_cars) loop
     if exists(select 1 from public.cars c where c.participant_id=person and c.year=(item->>'year')::int and lower(btrim(c.make))=lower(btrim(item->>'make')) and lower(btrim(c.model))=lower(btrim(item->>'model'))) then
      raise exception 'duplicate vehicle';
     end if;
     insert into public.cars(participant_id,year,make,model,color) values(person,(item->>'year')::int,btrim(item->>'make'),btrim(item->>'model'),nullif(btrim(item->>'color'),'')) returning id into car;
     perform car_show_private.preregister_car(cfg.event_id,car);
    end loop;
   end if;
   insert into public.registration_requests(id,event_id,participant_id,details,cars,status,payload_hash)
   values(request_id,cfg.event_id,person,details,new_cars,case when person is null and jsonb_array_length(new_cars)>0 then 'Pending' else 'Accepted' end,fingerprint);
   return jsonb_build_object('ok',true,'pending',person is null and jsonb_array_length(new_cars)>0);
  exception when raise_exception then
   if SQLERRM='duplicate vehicle' then return '{"error":"This vehicle already exists. Find your record again and select the existing car, or ask staff if you own two identical vehicles."}'::jsonb; end if;
   return '{"error":"Please check your details and selected cars, then try again."}'::jsonb;
  when others then return '{"error":"Please check your details and selected cars, then try again."}'::jsonb;
  end;
 end if;
 return '{"error":"Invalid request."}'::jsonb;
end $$;

create or replace function public.registration_progress(p_registration uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'car_number',r.car_number::text,'vehicle_year',r.vehicle_year,'vehicle_make',r.vehicle_make,'vehicle_model',r.vehicle_model,'vehicle_color',r.vehicle_color,
 'owner_name',p.name,'owner_city',p.city,'owner_state',p.state,'event_name',e.name,'event_year',e.event_year,'historical',e.legacy_source_key is not null,'judging_open',e.judging_open,
 'progress',coalesce(s.progress_percentage,0),'sections',jsonb_build_object('body_paint',(s.coverage is not null and s.quality is not null and s.engine_bay is not null and s.original is not null),'body_plating',(s.plating_brass is not null),'interior',(s.dash is not null and s.seats is not null and s.carpet is not null and s.door_panels is not null),'wheels_tires',(s.rims_hub_caps is not null and s.tires is not null),'engine',(s.block is not null and s.intake is not null and s.belts_hoses_caps is not null and s.radiator is not null and s.breather is not null),'appearance',(s.appearance is not null)))
 from public.event_registrations r join public.events e on e.id=r.event_id join public.participants p on p.id=r.participant_id left join public.scores s on s.event_registration_id=r.id
 where r.id=p_registration and r.car_number is not null;
$$;

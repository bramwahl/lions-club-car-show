-- Approved arrival workflow: pre-registration does not reserve a public number.
-- Existing numbered registrations, including the complete 2025 import, are unchanged.
alter table public.event_registrations alter column car_number drop not null;

create function car_show_private.preregister_car(p_event uuid,p_car uuid)
returns public.event_registrations language plpgsql set search_path='' as $$
declare c public.cars; result public.event_registrations;
begin
 perform 1 from public.events where id=p_event and legacy_source_key is null for update;
 if not found then raise exception 'Historical event is read-only' using errcode='42501'; end if;
 select * into strict c from public.cars where id=p_car for share;
 insert into public.event_registrations(event_id,car_id,participant_id,car_number,vehicle_year,vehicle_make,vehicle_model,classification)
 values(p_event,c.id,c.participant_id,null,c.year,c.make,c.model,
 case when c.year<1950 then 'Pre-1950' when c.year<1960 then '1950s' when c.year<1970 then '1960s' when c.year<1980 then '1970s' when c.year<1990 then '1980s' when c.year<2000 then '1990s' else 'Post-2000' end) returning * into result;
 return result;
end $$;
revoke all on function car_show_private.preregister_car(uuid,uuid) from public,anon,authenticated;

create or replace function car_show_private.protect_registration() returns trigger
language plpgsql security definer set search_path='' as $$
declare n bigint;
begin
 if (NEW.vehicle_year,NEW.vehicle_make,NEW.vehicle_model,NEW.car_id,NEW.event_id,NEW.participant_id)
 is distinct from (OLD.vehicle_year,OLD.vehicle_make,OLD.vehicle_model,OLD.car_id,OLD.event_id,OLD.participant_id)
 then raise exception 'Historical registration identity and vehicle snapshot are immutable' using errcode='23514'; end if;
 if NEW.car_number is distinct from OLD.car_number then raise exception 'Public car numbers are assigned at check-in and cannot be edited' using errcode='23514'; end if;
 if OLD.car_number is null and NEW.status='Checked-in' then
  select next_car_number into n from public.events where id=NEW.event_id and legacy_source_key is null for update;
  if not found then raise exception 'Historical event is read-only' using errcode='42501'; end if;
  NEW.car_number:=n;
  update public.events set next_car_number=n+1 where id=NEW.event_id;
 end if;
 return NEW;
end $$;

create or replace function public.admin_register_cars(p_event uuid,p_participant uuid,p_cars uuid[],p_check_in boolean default false) returns uuid[]
language plpgsql security definer set search_path='' as $$
declare chosen_car uuid; reg public.event_registrations; result uuid[]:='{}';
begin
 perform car_show_private.require_staff(true);
 if p_cars is null or cardinality(p_cars) not between 1 and 100 or p_check_in is null then raise exception 'Choose 1 to 100 cars' using errcode='22023'; end if;
 perform 1 from public.events where id=p_event and legacy_source_key is null for update;
 if not found then raise exception 'Historical event is read-only' using errcode='42501'; end if;
 for chosen_car in select value from unnest(p_cars) with ordinality as selected(value,position) group by value order by min(position) loop
  perform 1 from public.cars where id=chosen_car and participant_id=p_participant for share;
  if not found then raise exception 'Car does not belong to participant' using errcode='22023'; end if;
  select * into reg from public.event_registrations where event_id=p_event and car_id=chosen_car;
  if reg.id is null then reg:=car_show_private.preregister_car(p_event,chosen_car); end if;
  if p_check_in then update public.event_registrations set status='Checked-in' where id=reg.id and status is distinct from 'Judged'; end if;
  result:=array_append(result,reg.id);
 end loop;
 return result;
end $$;

-- Single-car arrival: registration, payment, check-in and numbering commit together.
create function public.admin_arrival(p_event uuid,p_participant uuid,p_car uuid,p_payment text) returns uuid
language plpgsql security definer set search_path='' as $$
declare ids uuid[];
begin
 perform car_show_private.require_staff(true);
 if p_payment is null or p_payment not in ('Paid','Unpaid') then raise exception 'Choose payment status' using errcode='22023'; end if;
 ids:=public.admin_register_cars(p_event,p_participant,array[p_car],true);
 update public.event_registrations set payment_status=p_payment where id=ids[1];
 return ids[1];
end $$;
revoke all on function public.admin_arrival(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_arrival(uuid,uuid,uuid,text) to authenticated;

-- CSV staging also must not consume arrival numbers.
create or replace function public.admin_import_entrants(p_event uuid,p_rows jsonb,p_request uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare actor public.profiles; previous car_show_private.workflow_csv_runs; fingerprint text; item jsonb; participant uuid; car uuid; reg public.event_registrations; year integer; count_rows integer;
begin
 actor:=car_show_private.require_staff(true);
 if p_request is null or p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'Invalid import' using errcode='22023'; end if;
 count_rows:=jsonb_array_length(p_rows);if count_rows not between 1 and 500 then raise exception 'Import 1 to 500 rows' using errcode='22023';end if;
 perform 1 from public.events where id=p_event and legacy_source_key is null for update;if not found then raise exception 'Historical event is read-only' using errcode='42501';end if;
 fingerprint:=encode(sha256(convert_to(p_rows::text,'UTF8')),'hex');
 select * into previous from car_show_private.workflow_csv_runs where request_id=p_request;
 if found then
   if previous.event_id<>p_event or previous.actor_id is distinct from actor.id or previous.payload_hash<>fingerprint then raise exception 'Import request already used' using errcode='23505';end if;
   return previous.imported_rows;
 end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(item)<>'object' or coalesce(item->>'name','')='' or coalesce(item->>'make','')='' or coalesce(item->>'model','')='' or coalesce(item->>'year','')!~'^[0-9]{4}$' then raise exception 'Invalid CSV row' using errcode='22023';end if;
  year:=(item->>'year')::integer;if year not between 1901 and 2155 then raise exception 'Invalid vehicle year' using errcode='22023';end if;
  -- Legacy CSV intentionally creates one participant per row, without deduplication.
  insert into public.participants(name,email,phone,address,city,state,zip) values(item->>'name',coalesce(item->>'email',''),item->>'phone',item->>'address',item->>'city',item->>'state',item->>'zip') returning id into participant;
  insert into public.cars(participant_id,year,make,model,notes) values(participant,year,item->>'make',item->>'model',item->>'notes') returning id into car;
  reg:=car_show_private.preregister_car(p_event,car);
  update public.event_registrations set status='Archived',payment_status='Unpaid',classification=case when year<1950 then 'Pre-1950' when year<1960 then '1950s' when year<1970 then '1960s' when year<1980 then '1970s' when year<1990 then '1980s' when year<2000 then '1990s' else 'Post-2000' end where id=reg.id;
 end loop;
 insert into car_show_private.workflow_csv_runs(request_id,event_id,actor_id,payload_hash,imported_rows) values(p_request,p_event,actor.id,fingerprint,count_rows);
 return count_rows;
end $$;
revoke all on function public.admin_import_entrants(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.admin_import_entrants(uuid,jsonb,uuid) to authenticated;

create or replace function public.admin_register_car(p_event_id uuid,p_car_id uuid) returns public.event_registrations
language plpgsql security definer set search_path='' as $$
begin
 perform car_show_private.require_staff(true);
 return car_show_private.preregister_car(p_event_id,p_car_id);
end $$;

create function public.admin_preregister(p_event uuid,p_participant uuid,p_cars uuid[],p_payment text default null) returns uuid[]
language plpgsql security definer set search_path='' as $$
declare ids uuid[];
begin
 perform car_show_private.require_staff(true);
 if p_payment is not null and p_payment not in ('Paid','Unpaid') then raise exception 'Invalid payment status' using errcode='22023'; end if;
 ids:=public.admin_register_cars(p_event,p_participant,p_cars,false);
 if p_payment is not null then update public.event_registrations set payment_status=p_payment where id=any(ids); end if;
 return ids;
end $$;
revoke all on function public.admin_preregister(uuid,uuid,uuid[],text) from public,anon,authenticated;
grant execute on function public.admin_preregister(uuid,uuid,uuid[],text) to authenticated;

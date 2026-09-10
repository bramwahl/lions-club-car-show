-- Retry metadata only; no CSV contents, participant contacts or passwords stored here.
create table car_show_private.workflow_csv_runs(request_id uuid primary key,event_id uuid not null references public.events(id),actor_id uuid references auth.users(id) on delete set null,payload_hash text not null,imported_rows integer not null,created_at timestamptz not null default now());
revoke all on car_show_private.workflow_csv_runs from public,anon,authenticated;
create function public.admin_import_entrants(p_event uuid,p_rows jsonb,p_request uuid) returns integer
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
  reg:=car_show_private.register_car(p_event,car);
  update public.event_registrations set status='Archived',payment_status='Unpaid',classification=case when year<1950 then 'Pre-1950' when year<1960 then '1950s' when year<1970 then '1960s' when year<1980 then '1970s' when year<1990 then '1980s' when year<2000 then '1990s' else 'Post-2000' end where id=reg.id;
 end loop;
 insert into car_show_private.workflow_csv_runs(request_id,event_id,actor_id,payload_hash,imported_rows) values(p_request,p_event,actor.id,fingerprint,count_rows);
 return count_rows;
end $$;
revoke all on function public.admin_import_entrants(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.admin_import_entrants(uuid,jsonb,uuid) to authenticated;

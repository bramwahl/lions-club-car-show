-- Admin workflow operations. No imported row is changed by this migration.
create function public.admin_directory(p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform car_show_private.require_staff(true);
 case p_kind
 when 'participants' then select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('legacy_participant_id',p.legacy_participant_id::text) order by p.legacy_participant_id nulls last,p.id),'[]') into result from public.participants p;
 when 'cars' then select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('legacy_car_id',c.legacy_car_id::text)),'[]') into result from public.cars c;
 when 'events' then select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('next_car_number',e.next_car_number::text) order by e.event_year desc,e.created_at desc),'[]') into result from public.events e;
 else raise exception 'Unknown directory' using errcode='22023';
 end case;
 return result;
end $$;
create function public.admin_registrations(p_event uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform car_show_private.require_staff(true);
 return (select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('car_number',r.car_number::text,'legacy_car_id',r.legacy_car_id::text,'participant',to_jsonb(p),'score',to_jsonb(s)) order by r.car_number),'[]')
 from public.event_registrations r join public.participants p on p.id=r.participant_id left join public.scores s on s.event_registration_id=r.id where r.event_id=p_event);
end $$;
create function public.admin_award_inputs(p_event uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform car_show_private.require_staff(true);
 -- Same query/order as the validated Phase 1A oracle, with no secondary tie key.
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
 SELECT r.car_id::text,c.legacy_car_id::text,s.legacy_score_id::text,r.car_number::text,r.vehicle_year,r.vehicle_make,r.vehicle_model,
 p.name AS participant_name,p.city AS participant_city,s.total_score,s.overall_paint,s.overall_interior,s.overall_engine
 FROM public.event_registrations r JOIN public.scores s ON s.event_registration_id=r.id
 JOIN public.participants p ON p.id=r.participant_id JOIN public.cars c ON c.id=r.car_id
 WHERE r.event_id=p_event ORDER BY s.total_score DESC NULLS LAST) x);
end $$;
create function public.admin_open_judging(p_event uuid,p_open boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform car_show_private.require_staff(true);
 perform pg_advisory_xact_lock(20250907,3);
 if p_open is null or not exists(select 1 from public.events where id=p_event and legacy_source_key is null) then raise exception 'Historical event is read-only' using errcode='42501'; end if;
 if p_open then update public.events set judging_open=false where judging_open; end if;
 update public.events set judging_open=p_open where id=p_event;
end $$;
create function public.admin_register_cars(p_event uuid,p_participant uuid,p_cars uuid[],p_check_in boolean default false) returns uuid[]
language plpgsql security definer set search_path='' as $$
declare chosen_car uuid; reg public.event_registrations; result uuid[]:='{}';
begin
 perform car_show_private.require_staff(true);
 if p_cars is null or cardinality(p_cars) not between 1 and 100 or p_check_in is null then raise exception 'Choose 1 to 100 cars' using errcode='22023'; end if;
 perform 1 from public.events where id=p_event and legacy_source_key is null for update;
 if not found then raise exception 'Historical event is read-only' using errcode='42501'; end if;
 for chosen_car in select distinct unnest(p_cars) loop
   perform 1 from public.cars where id=chosen_car and participant_id=p_participant for share;
   if not found then raise exception 'Car does not belong to participant' using errcode='22023'; end if;
   select * into reg from public.event_registrations where event_id=p_event and public.event_registrations.car_id=chosen_car;
   if reg.id is null then
     reg := car_show_private.register_car(p_event,chosen_car);
     update public.event_registrations set classification=case when vehicle_year<1950 then 'Pre-1950' when vehicle_year<1960 then '1950s' when vehicle_year<1970 then '1960s' when vehicle_year<1980 then '1970s' when vehicle_year<1990 then '1980s' when vehicle_year<2000 then '1990s' else 'Post-2000' end where id=reg.id;
   end if;
   if p_check_in then update public.event_registrations set status='Checked-in' where id=reg.id and status is distinct from 'Judged'; end if;
   result:=array_append(result,reg.id);
 end loop;
 return result;
end $$;
create function public.admin_add_participant(p_values jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
 perform car_show_private.require_staff(true);
 if jsonb_typeof(p_values)<>'object' or coalesce(length(btrim(p_values->>'name')),0)=0 or coalesce(length(p_values->>'email'),0)=0 then raise exception 'Name and email required' using errcode='22023'; end if;
 -- Preserve the legacy Admin-add duplicate-email check without global uniqueness.
 perform pg_advisory_xact_lock(20250907,4);
 if exists(select 1 from public.participants where lower(email)=lower(p_values->>'email')) then raise exception 'Participant email already exists; find the existing participant' using errcode='23505'; end if;
 insert into public.participants(name,email,phone,address,city,state,zip) values(p_values->>'name',p_values->>'email',p_values->>'phone',p_values->>'address',p_values->>'city',p_values->>'state',p_values->>'zip') returning id into new_id;
 return new_id;
end $$;
revoke all on function public.admin_directory(text),public.admin_registrations(uuid),public.admin_award_inputs(uuid),public.admin_open_judging(uuid,boolean),public.admin_register_cars(uuid,uuid,uuid[],boolean),public.admin_add_participant(jsonb) from public,anon,authenticated;
grant execute on function public.admin_directory(text),public.admin_registrations(uuid),public.admin_award_inputs(uuid),public.admin_open_judging(uuid,boolean),public.admin_register_cars(uuid,uuid,uuid[],boolean),public.admin_add_participant(jsonb) to authenticated;

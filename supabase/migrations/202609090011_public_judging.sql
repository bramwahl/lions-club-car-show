-- Explicitly approved public QR projection; no anonymous directory or score access.
create function public.registration_progress(p_registration uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'car_number',r.car_number::text,'vehicle_year',r.vehicle_year,'vehicle_make',r.vehicle_make,'vehicle_model',r.vehicle_model,
 'owner_name',p.name,'owner_city',p.city,'owner_state',p.state,'event_name',e.name,'event_year',e.event_year,'historical',e.legacy_source_key is not null,'judging_open',e.judging_open,
 'progress',coalesce(s.progress_percentage,0),'sections',jsonb_build_object('body_paint',(s.coverage is not null and s.quality is not null and s.engine_bay is not null and s.original is not null),'body_plating',(s.plating_brass is not null),'interior',(s.dash is not null and s.seats is not null and s.carpet is not null and s.door_panels is not null),'wheels_tires',(s.rims_hub_caps is not null and s.tires is not null),'engine',(s.block is not null and s.intake is not null and s.belts_hoses_caps is not null and s.radiator is not null and s.breather is not null),'appearance',(s.appearance is not null)))
 from public.event_registrations r join public.events e on e.id=r.event_id join public.participants p on p.id=r.participant_id left join public.scores s on s.event_registration_id=r.id
 where r.id=p_registration and r.car_number is not null;
$$;
revoke all on function public.registration_progress(uuid) from public,anon,authenticated;
grant execute on function public.registration_progress(uuid) to anon,authenticated;

-- Save one or more complete sections atomically, retaining separate append-only history.
create function public.submit_sections(p_registration_id uuid,p_submissions jsonb) returns uuid[]
language plpgsql security definer set search_path='' as $$
declare item jsonb; section text; field text; result uuid[]:='{}'; seen text[]:='{}'; fields jsonb:='{"body_paint": ["coverage", "quality", "engine_bay", "original"], "body_plating": ["plating_brass"], "interior": ["dash", "seats", "carpet", "door_panels"], "wheels_tires": ["rims_hub_caps", "tires"], "engine": ["block", "intake", "belts_hoses_caps", "radiator", "breather"], "appearance": ["appearance"]}'::jsonb;
begin
 perform car_show_private.require_staff();
 if p_submissions is null or jsonb_typeof(p_submissions)<>'array' or jsonb_array_length(p_submissions) not between 1 and 6 then raise exception 'Choose one to six sections' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(p_submissions) loop
  section:=item->>'section';
  if section is null or not fields ? section or section=any(seen) then raise exception 'Invalid or repeated section' using errcode='22023'; end if;
  seen:=array_append(seen,section);
  if jsonb_typeof(item->'values') is distinct from 'object' then raise exception 'Invalid scores' using errcode='22023'; end if;
  for field in select jsonb_array_elements_text(fields->section) loop
   if item->'values'->>field is null or btrim(item->'values'->>field)='' then raise exception 'Complete every item in the selected section' using errcode='22023'; end if;
  end loop;
  result:=array_append(result,car_show_private.save_score(p_registration_id,section,item->'values',(item->>'request')::uuid,null,false));
 end loop;
 return result;
end $$;
revoke all on function public.submit_sections(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.submit_sections(uuid,jsonb) to authenticated;

-- The existing single-section endpoint now enforces the same completeness contract.
create or replace function public.submit_section(p_registration_id uuid,p_section text,p_values jsonb,p_request_id uuid) returns uuid
language sql security definer set search_path='' as $$
 select (public.submit_sections(p_registration_id,jsonb_build_array(jsonb_build_object('section',p_section,'values',p_values,'request',p_request_id))))[1];
$$;

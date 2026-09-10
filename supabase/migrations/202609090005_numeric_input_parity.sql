-- Align JSON numeric/zero-padded input handling with the unchanged Phase 1A validator.
-- Only new authenticated submissions use this service; legacy snapshots remain closed.
create or replace function car_show_private.save_score(p_registration uuid,p_section text,p_values jsonb,p_request uuid,p_expected jsonb,p_admin boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor public.profiles; reg public.event_registrations; score public.scores; prior public.score_history;
  maxima jsonb := '{"coverage": 15, "quality": 20, "engine_bay": 20, "original": 5, "plating_brass": 10, "dash": 10, "seats": 10, "carpet": 10, "door_panels": 10, "rims_hub_caps": 10, "tires": 10, "block": 10, "intake": 10, "belts_hoses_caps": 5, "radiator": 10, "breather": 5, "appearance": 10}'::jsonb; sections jsonb := '{"body_paint": {"coverage": 15, "quality": 20, "engine_bay": 20, "original": 5}, "body_plating": {"plating_brass": 10}, "interior": {"dash": 10, "seats": 10, "carpet": 10, "door_panels": 10}, "wheels_tires": {"rims_hub_caps": 10, "tires": 10}, "engine": {"block": 10, "intake": 10, "belts_hoses_caps": 5, "radiator": 10, "breather": 5}, "appearance": {"appearance": 10}}'::jsonb;
  allowed jsonb; normalized jsonb := '{}'::jsonb; before_values jsonb; after_values jsonb;
  field text; raw jsonb; value_text text; n numeric; completed integer; progress numeric; history_id uuid;
begin
  actor := car_show_private.require_staff(p_admin);
  if p_request is null or p_values is null or jsonb_typeof(p_values)<>'object' then raise exception 'Invalid submission' using errcode='22023'; end if;
  if p_admin then
    if p_section is not null then raise exception 'Quick Edit has no judging section' using errcode='22023'; end if;
    allowed := maxima;
  else
    if p_section is null or not sections ? p_section then raise exception 'Invalid judging section' using errcode='22023'; end if;
    allowed := sections->p_section;
  end if;
  if exists(select 1 from jsonb_object_keys(p_values) k where not allowed ? k) then raise exception 'Unknown score input' using errcode='22023'; end if;
  for field in select jsonb_object_keys(allowed) loop
    raw := p_values->field; value_text := p_values->>field;
    if raw is null or raw='null'::jsonb or (jsonb_typeof(raw)='string' and btrim(value_text)='') then
      normalized := normalized || jsonb_build_object(field,null);
    else
      if jsonb_typeof(raw)='string' then
        if value_text !~ '^[0-9]+$' then raise exception 'Invalid score input' using errcode='22023'; end if;
        -- Bound the conversion without rejecting otherwise-valid leading zeros.
        value_text := coalesce(nullif(ltrim(value_text,'0'),''),'0');
        if length(value_text)>2 then raise exception 'Score exceeds maximum' using errcode='22023'; end if;
      elsif jsonb_typeof(raw)<>'number' then
        raise exception 'Invalid score input' using errcode='22023';
      end if;
      n := value_text::numeric;
      if n<0 or n<>trunc(n) then raise exception 'Invalid score input' using errcode='22023'; end if;
      if n > (maxima->>field)::integer then raise exception 'Score exceeds maximum' using errcode='22023'; end if;
      normalized := normalized || jsonb_build_object(field,n::integer);
    end if;
  end loop;
  select * into reg from public.event_registrations where id=p_registration for update;
  if reg.id is null or not exists(select 1 from public.events where id=reg.event_id and judging_open and legacy_source_key is null) then
    raise exception 'Judging is unavailable' using errcode='42501';
  end if;
  select * into score from public.scores where event_registration_id=reg.id for update;
  select * into prior from public.score_history where request_id=p_request;
  if prior.id is not null then
    if prior.score_id is distinct from score.id or prior.user_id is distinct from actor.id
      or prior.action_type is distinct from (case when p_admin then 'admin_quick_edit' else 'section_submission' end)
      or prior.section is distinct from p_section
      or exists(select 1 from jsonb_each(normalized) kv where prior.score_values_after->kv.key is distinct from kv.value)
      or (p_admin and prior.score_values_before is distinct from p_expected) then
      raise exception 'Request identifier already used' using errcode='23505';
    end if;
    return prior.id;
  end if;
  if score.id is null then
    insert into public.scores(event_registration_id) values(reg.id) returning * into score;
  end if;
  select jsonb_object_agg(k,to_jsonb(score)->k) into before_values from jsonb_object_keys(maxima) k;
  if p_admin and (p_expected is null or not car_show_private.valid_score_vector(p_expected) or p_expected is distinct from before_values) then
    raise exception 'Score changed; reload before editing' using errcode='40001';
  end if;
  after_values := before_values || normalized;
  select count(*) into completed from jsonb_each(after_values) kv where kv.value <> 'null'::jsonb;
  progress := round(completed*100.0/17,2);
  update public.scores set coverage=(after_values->>'coverage')::smallint,quality=(after_values->>'quality')::smallint,engine_bay=(after_values->>'engine_bay')::smallint,original=(after_values->>'original')::smallint,plating_brass=(after_values->>'plating_brass')::smallint,dash=(after_values->>'dash')::smallint,seats=(after_values->>'seats')::smallint,carpet=(after_values->>'carpet')::smallint,door_panels=(after_values->>'door_panels')::smallint,rims_hub_caps=(after_values->>'rims_hub_caps')::smallint,tires=(after_values->>'tires')::smallint,block=(after_values->>'block')::smallint,intake=(after_values->>'intake')::smallint,belts_hoses_caps=(after_values->>'belts_hoses_caps')::smallint,radiator=(after_values->>'radiator')::smallint,breather=(after_values->>'breather')::smallint,appearance=(after_values->>'appearance')::smallint,progress_percentage=progress where id=score.id;
  if progress=100 then update public.event_registrations set status='Judged' where id=reg.id; end if;
  insert into public.score_history(score_id,action_type,section,score_values_before,score_values_after,user_id,judge_name_snapshot,submitted_at,timestamp_basis,request_id)
    values(score.id,case when p_admin then 'admin_quick_edit' else 'section_submission' end,p_section,before_values,after_values,actor.id,actor.display_name,now(),'auth-server',p_request)
    returning id into history_id;
  return history_id;
end $$;

-- Private, SECURITY INVOKER foundation functions; no client role model or API grants.
create function car_show_private.protect_history() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' and pg_trigger_depth() > 1
     and OLD.user_id is not null and NEW.user_id is null
     and (to_jsonb(NEW) - 'user_id') = (to_jsonb(OLD) - 'user_id')
     and not exists (select 1 from auth.users where id = OLD.user_id) then
    return NEW;
  end if;
  raise exception 'History is append-only' using errcode = '23514';
end $$;
create trigger score_history_immutable before update or delete on public.score_history
for each row execute function car_show_private.protect_history();

create function car_show_private.protect_registration() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (NEW.vehicle_year, NEW.vehicle_make, NEW.vehicle_model, NEW.car_id,
      NEW.event_id, NEW.participant_id, NEW.car_number)
    is distinct from
     (OLD.vehicle_year, OLD.vehicle_make, OLD.vehicle_model, OLD.car_id,
      OLD.event_id, OLD.participant_id, OLD.car_number) then
    raise exception 'Historical registration identity and vehicle snapshot are immutable' using errcode = '23514';
  end if;
  return NEW;
end $$;
create trigger registration_snapshot_immutable before update on public.event_registrations
for each row execute function car_show_private.protect_registration();

create function car_show_private.validate_event_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if NEW.timezone_name is null then
    if NEW.legacy_source_key is distinct from 'qkby:2025' then
      raise exception 'New events require a timezone' using errcode = '23514';
    end if;
  elsif not exists (select 1 from pg_catalog.pg_timezone_names where name = NEW.timezone_name) then
    raise exception 'Unsupported timezone' using errcode = '23514';
  end if;
  if TG_OP = 'UPDATE' and NEW.next_car_number < OLD.next_car_number then
    raise exception 'Car number allocator must not rewind' using errcode = '23514';
  end if;
  return NEW;
end $$;
create trigger event_timezone_check before insert or update on public.events
for each row execute function car_show_private.validate_event_timezone();

create function car_show_private.register_car(p_event uuid, p_car uuid)
returns public.event_registrations language plpgsql set search_path = '' as $$
declare n bigint; c public.cars; result public.event_registrations;
begin
  select next_car_number into strict n from public.events where id = p_event for update;
  select * into strict c from public.cars where id = p_car for share;
  insert into public.event_registrations(event_id, car_id, participant_id, car_number,
    vehicle_year, vehicle_make, vehicle_model)
    values (p_event, c.id, c.participant_id, n, c.year, c.make, c.model)
    returning * into result;
  update public.events set next_car_number = n + 1 where id = p_event;
  return result;
end $$;
create function car_show_private.vote_lions_choice(p_registration uuid)
returns integer language plpgsql set search_path = '' as $$
declare votes integer;
begin
  update public.event_registrations set lions_choice_votes = lions_choice_votes + 1
    where id = p_registration returning lions_choice_votes into strict votes;
  return votes;
end $$;

-- Strict validation before smallint casts; numeric JSON 1.5 cannot round to an integer.
create function car_show_private.valid_score_vector(v jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare k text; value jsonb; m integer;
begin
  if v is null or jsonb_typeof(v) <> 'object' or (select count(*) from jsonb_object_keys(v)) <> 17 then return false; end if;
  for k, m in select * from jsonb_each_text('{"coverage":15,"quality":20,"engine_bay":20,"original":5,"plating_brass":10,"dash":10,"seats":10,"carpet":10,"door_panels":10,"rims_hub_caps":10,"tires":10,"block":10,"intake":10,"belts_hoses_caps":5,"radiator":10,"breather":5,"appearance":10}'::jsonb) loop
    value := v -> k;
    if value is null then return false; end if;
    if value <> 'null'::jsonb and
      (jsonb_typeof(value) <> 'number' or value::text !~ '^[0-9]+$') then return false; end if;
    if value <> 'null'::jsonb and (value::text)::numeric > m then return false; end if;
  end loop;
  return true;
end $$;
alter table public.score_history add constraint history_admin_vectors check (
  action_type <> 'admin_quick_edit' or
  (car_show_private.valid_score_vector(score_values_before) and car_show_private.valid_score_vector(score_values_after))
);

revoke all on all functions in schema car_show_private from public, anon, authenticated;

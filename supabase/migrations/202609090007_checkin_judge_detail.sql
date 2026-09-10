create function public.admin_check_in(p_event uuid,p_registrations uuid[]) returns integer
language plpgsql security definer set search_path='' as $$
declare result integer;
begin
 perform car_show_private.require_staff(true);
 if p_registrations is null or cardinality(p_registrations) not between 1 and 100 then raise exception 'Choose 1 to 100 registrations' using errcode='22023'; end if;
 perform 1 from public.events where id=p_event and legacy_source_key is null for update;
 if not found then raise exception 'Historical event is read-only' using errcode='42501'; end if;
 if exists(select 1 from unnest(p_registrations) x where not exists(select 1 from public.event_registrations r where r.id=x and r.event_id=p_event)) then raise exception 'Registration belongs to another event' using errcode='22023'; end if;
 perform 1 from public.event_registrations where id=any(p_registrations) order by id for update;
 update public.event_registrations set status='Checked-in' where id=any(p_registrations) and status is distinct from 'Judged';get diagnostics result=row_count;return result;
end $$;
create function public.judge_registration(p_registration uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform car_show_private.require_staff();
 return (select jsonb_build_object('id',r.id,'event_id',e.id,'event_name',e.name,'event_year',e.event_year,'car_number',r.car_number::text,'vehicle_year',r.vehicle_year,'vehicle_make',r.vehicle_make,'vehicle_model',r.vehicle_model,'classification',r.classification,'status',r.status,'lions_choice_votes',r.lions_choice_votes)
 from public.event_registrations r join public.events e on e.id=r.event_id where r.id=p_registration and e.judging_open and e.legacy_source_key is null);
end $$;
revoke all on function public.admin_check_in(uuid,uuid[]),public.judge_registration(uuid) from public,anon,authenticated;
grant execute on function public.admin_check_in(uuid,uuid[]),public.judge_registration(uuid) to authenticated;

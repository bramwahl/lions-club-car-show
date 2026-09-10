-- Preserve full per-car history and section attribution even after many resubmissions.
create function public.judge_full_history(p_registration uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform car_show_private.require_staff();
 return (select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'action_type',h.action_type,'section',h.section,'judge_name_snapshot',h.judge_name_snapshot,'submitted_at',h.submitted_at) order by h.submitted_at desc),'[]')
 from public.score_history h join public.scores s on s.id=h.score_id join public.event_registrations r on r.id=s.event_registration_id join public.events e on e.id=r.event_id
 where r.id=p_registration and e.judging_open and e.legacy_source_key is null);
end $$;
revoke all on function public.judge_full_history(uuid) from public,anon,authenticated;
grant execute on function public.judge_full_history(uuid) to authenticated;

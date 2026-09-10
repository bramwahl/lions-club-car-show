-- Local revision: do not apply to the shared database until release approval.
create table public.lions_choice_confirmations (
 event_id uuid primary key references public.events(id) on delete restrict,
 registration_id uuid not null references public.event_registrations(id) on delete restrict,
 confirmed_by uuid references auth.users(id) on delete set null,
 confirmed_name text not null,
 confirmed_at timestamptz not null default now()
);
alter table public.lions_choice_confirmations enable row level security;
revoke all on public.lions_choice_confirmations from anon,authenticated;
create function public.admin_lions_choice(p_event uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform car_show_private.require_staff(true);
 return (select to_jsonb(c) from public.lions_choice_confirmations c where event_id=p_event);
end $$;
create function public.admin_confirm_lions_choice(p_event uuid,p_registration uuid,p_expected uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare current_id uuid; actor_name text;
begin
 perform car_show_private.require_staff(true);
 perform 1 from public.events where id=p_event and legacy_source_key is null for update;
 if not found then raise exception 'Historical event is read-only' using errcode='42501'; end if;
 if not exists(select 1 from public.event_registrations where id=p_registration and event_id=p_event and car_number is not null and status in ('Checked-in','Judged')) then raise exception 'Select a checked-in car in this event'; end if;
 select registration_id into current_id from public.lions_choice_confirmations where event_id=p_event;
 if current_id=p_registration then return; end if;
 if current_id is distinct from p_expected then raise exception 'Winner changed; refresh before confirming'; end if;
 select display_name into actor_name from public.profiles where id=auth.uid();
 insert into public.lions_choice_confirmations(event_id,registration_id,confirmed_by,confirmed_name)
 values(p_event,p_registration,auth.uid(),actor_name)
 on conflict(event_id) do update set registration_id=excluded.registration_id,confirmed_by=excluded.confirmed_by,confirmed_name=excluded.confirmed_name,confirmed_at=now();
end $$;
revoke all on function public.admin_lions_choice(uuid),public.admin_confirm_lions_choice(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_lions_choice(uuid),public.admin_confirm_lions_choice(uuid,uuid,uuid) to authenticated;

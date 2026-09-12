-- Record actual first check-in; never fabricate earlier arrival timestamps.
alter table public.event_registrations add column checked_in_at timestamptz;
create function car_show_private.record_checkin_time() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  NEW.checked_in_at:=OLD.checked_in_at;
  if OLD.car_number is null and NEW.car_number is not null and NEW.status='Checked-in' then
   NEW.checked_in_at:=statement_timestamp();
  end if;
 else
  NEW.checked_in_at:=null;
 end if;
 return NEW;
end $$;
-- Runs after registration_snapshot_immutable, which assigns the first number.
create trigger z_record_checkin_time before insert or update on public.event_registrations
for each row execute function car_show_private.record_checkin_time();

-- The admin form includes color on both create and edit.
-- Existing cars_admin_insert/update RLS policies still require an active admin.
grant insert(color), update(color) on public.cars to authenticated;

-- PHASE 0 REVIEW ARTIFACT: revised to approved D1-D10 decisions.
-- DO NOT EXECUTE: schema/migration execution and Phase 1 remain unauthorized.
-- Supabase auth.users is assumed; no policies, roles, accounts or mutations are deployed.
-- Imported UUIDs are supplied by fixed UUIDv5 mapping; defaults are for new rows.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  event_year smallint not null,
  event_date date,
  timezone_name text default 'America/Indiana/Indianapolis',
  -- Import the unresolved legacy event timezone explicitly as NULL.
  next_car_number bigint not null default 1 check (next_car_number >= 1),
  -- Future allocator locks this event row and increments in the registration transaction.
  -- Import seeds MAX(car_number)+1; no allocator function is implemented here.
  legacy_source_key text unique,
  created_at timestamptz not null default now()
);
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  legacy_participant_id bigint unique,
  name varchar(255) not null,
  email varchar(255) not null,
  phone varchar(50), address text, city varchar(255), state varchar(100), zip varchar(20)
);
create table public.cars (
  id uuid primary key default gen_random_uuid(),
  legacy_car_id bigint unique,
  participant_id uuid not null references public.participants(id) on delete restrict,
  year smallint not null check (year = 0 or year between 1901 and 2155),
  make varchar(255) not null,
  model varchar(255) not null,
  notes text
);
create index cars_participant_idx on public.cars(participant_id);
create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  legacy_car_id bigint,
  event_id uuid not null references public.events(id) on delete restrict,
  car_id uuid not null references public.cars(id) on delete restrict,
  participant_id uuid not null references public.participants(id) on delete restrict,
  car_number bigint not null,
  vehicle_year smallint not null check (vehicle_year = 0 or vehicle_year between 1901 and 2155),
  vehicle_make varchar(255) not null,
  vehicle_model varchar(255) not null,
  lions_choice_votes integer not null default 0 check (lions_choice_votes >= 0),
  classification varchar(20) check (classification in ('','Pre-1950','1950s','1960s','1970s','1980s','1990s','Post-2000')),
  status varchar(20) default 'Registered' check (status in ('','Archived','Registered','Checked-in','Judged')),
  payment_status text not null default 'Unpaid' check (payment_status in ('Paid','Unpaid')),
  legacy_event_assignment text,
  unique(event_id, legacy_car_id),
  unique(event_id, car_id), -- approved D4: stronger than legacy storage
  unique(event_id, car_number) -- approved D4; never a global number constraint
);
create index registrations_car_idx on public.event_registrations(car_id);
create index registrations_participant_idx on public.event_registrations(participant_id);
create index registrations_filters_idx on public.event_registrations(event_id,status,payment_status);
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  legacy_score_id bigint unique,
  event_registration_id uuid not null unique references public.event_registrations(id) on delete restrict,
  coverage smallint check (coverage between 0 and 15),
  quality smallint check (quality between 0 and 20),
  engine_bay smallint check (engine_bay between 0 and 20),
  original smallint check (original between 0 and 5),
  plating_brass smallint check (plating_brass between 0 and 10),
  dash smallint check (dash between 0 and 10),
  seats smallint check (seats between 0 and 10),
  carpet smallint check (carpet between 0 and 10),
  door_panels smallint check (door_panels between 0 and 10),
  rims_hub_caps smallint check (rims_hub_caps between 0 and 10),
  tires smallint check (tires between 0 and 10),
  block smallint check (block between 0 and 10),
  intake smallint check (intake between 0 and 10),
  belts_hoses_caps smallint check (belts_hoses_caps between 0 and 5),
  radiator smallint check (radiator between 0 and 10),
  breather smallint check (breather between 0 and 5),
  appearance smallint check (appearance between 0 and 10),
  overall_paint integer generated always as (coverage + quality + engine_bay + original) stored,
  overall_interior integer generated always as (dash + seats + carpet + door_panels) stored,
  overall_engine integer generated always as (block + intake + belts_hoses_caps + radiator + breather) stored,
  total_score integer generated always as (coverage + quality + engine_bay + original + plating_brass + dash + seats + carpet + door_panels + rims_hub_caps + tires + block + intake + belts_hoses_caps + radiator + breather + appearance) stored,
  progress_percentage numeric(5,2) not null default 0 check (progress_percentage between 0 and 100)
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text
  -- No role model or legacy password import. Roles/policies are a later decision.
);
create table public.score_history (
  id uuid primary key default gen_random_uuid(),
  legacy_update_id bigint unique,
  score_id uuid not null references public.scores(id) on delete restrict,
  action_type text not null check (action_type in ('section_submission','admin_quick_edit')),
  section text,
  check (
    (action_type = 'section_submission' and section is not null
      and section in ('body_paint','body_plating','interior','wheels_tires','engine','appearance'))
    or (action_type = 'admin_quick_edit' and section is null)
  ),
  score_values_before jsonb,
  score_values_after jsonb,
  -- New admin edits capture all 17 inputs before/after under the score lock.
  -- No generated totals or contact data; importer leaves these NULL.
  check (score_values_before is null or jsonb_typeof(score_values_before) = 'object'),
  check (score_values_after is null or jsonb_typeof(score_values_after) = 'object'),
  check (action_type <> 'admin_quick_edit' or
    (score_values_before is not null and score_values_after is not null)),
  user_id uuid references auth.users(id) on delete set null,
  judge_name_snapshot text,
  submitted_at timestamptz,
  legacy_wp_user_id numeric(20,0) check (legacy_wp_user_id between 0 and 18446744073709551615),
  legacy_username text,
  legacy_timestamp timestamp without time zone,
  legacy_updated_at timestamp without time zone,
  legacy_timestamp_raw text,
  legacy_updated_at_raw text,
  legacy_car_id_raw bigint,
  legacy_section_raw text,
  legacy_section_updated_raw text,
  timestamp_basis text not null check (timestamp_basis in ('legacy-unresolved','legacy-confirmed','auth-server')),
  check (legacy_update_id is not null or (submitted_at is not null and judge_name_snapshot is not null)),
  check (legacy_update_id is null or
    (legacy_wp_user_id is not null and action_type = 'section_submission'
      and score_values_before is null and score_values_after is null)),
  check (timestamp_basis <> 'legacy-unresolved' or submitted_at is null),
  check (legacy_update_id is not null or timestamp_basis = 'auth-server')
  -- user_id is required by authenticated submission service for NEW writes.
  -- It may become NULL after account deletion; no fake historic Auth users.
  -- No unique(score_id, section): repetitions MUST remain distinct.
  -- Append-only enforcement, admin authorization and validated writes are future work.
  -- SET NULL on Auth deletion is the sole system attribution exception.
);
create index updates_score_time_idx on public.score_history(score_id,submitted_at desc);
create index updates_legacy_time_idx on public.score_history(score_id,legacy_timestamp desc);
create index updates_user_idx on public.score_history(user_id);

alter table public.events enable row level security;
alter table public.participants enable row level security;
alter table public.cars enable row level security;
alter table public.event_registrations enable row level security;
alter table public.scores enable row level security;
alter table public.profiles enable row level security;
alter table public.score_history enable row level security;
-- Intentionally no permissive policies. This is not a usable client API yet.
-- No grants/RPCs/security-definer functions are proposed for deployment here.

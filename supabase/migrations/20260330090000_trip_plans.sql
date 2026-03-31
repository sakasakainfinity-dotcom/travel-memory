create table if not exists public.trip_plans (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  departure_from text,
  people_count int,
  relationship text,
  trip_length_type text not null check (trip_length_type in ('day_trip', 'overnight')),
  nights int,
  destination_1 text,
  destination_2 text,
  must_do text,
  breakfast_note text,
  lunch_note text,
  dinner_note text,
  budget_level text,
  estimated_cost_min int,
  estimated_cost_max int,
  visibility text not null check (visibility in ('public', 'private', 'pair')),
  cover_photo_url text,
  share_token text unique,
  is_archived boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.trip_plan_stops (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.trip_plans(id) on delete cascade,
  sort_order int not null,
  day_number int not null,
  start_time text,
  end_time text,
  category text,
  title text not null,
  memo text,
  address text,
  lat double precision,
  lng double precision,
  candidate_group_key text,
  candidate_options jsonb,
  is_primary boolean not null default true,
  photo_url text,
  storage_path text,
  status text not null default 'planned' check (status in ('planned', 'visited', 'skipped')),
  estimated_cost_min int,
  estimated_cost_max int,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.ai_plan_generations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  input_payload jsonb not null,
  output_payload jsonb not null,
  provider text not null,
  model text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_trip_plans_space_created_at on public.trip_plans(space_id, created_at desc);
create index if not exists idx_trip_plans_visibility on public.trip_plans(visibility);
create index if not exists idx_trip_plan_stops_plan_sort on public.trip_plan_stops(plan_id, day_number, sort_order);

alter table public.trip_plans enable row level security;
alter table public.trip_plan_stops enable row level security;
alter table public.ai_plan_generations enable row level security;

create or replace function public.can_read_trip_plan(p public.trip_plans)
returns boolean
language sql
stable
as $$
  select (
    p.visibility = 'public'
    or p.created_by = auth.uid()
    or (p.visibility = 'pair' and public.is_space_member(p.space_id))
  );
$$;

drop policy if exists trip_plans_select on public.trip_plans;
create policy trip_plans_select on public.trip_plans
for select
using (public.can_read_trip_plan(trip_plans));

drop policy if exists trip_plans_insert on public.trip_plans;
create policy trip_plans_insert on public.trip_plans
for insert to authenticated
with check (created_by = auth.uid() and public.is_space_member(space_id));

drop policy if exists trip_plans_update on public.trip_plans;
create policy trip_plans_update on public.trip_plans
for update to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists trip_plans_delete on public.trip_plans;
create policy trip_plans_delete on public.trip_plans
for delete to authenticated
using (created_by = auth.uid());

drop policy if exists trip_plan_stops_select on public.trip_plan_stops;
create policy trip_plan_stops_select on public.trip_plan_stops
for select
using (
  exists (
    select 1
    from public.trip_plans p
    where p.id = trip_plan_stops.plan_id
      and public.can_read_trip_plan(p)
  )
);

drop policy if exists trip_plan_stops_insert on public.trip_plan_stops;
create policy trip_plan_stops_insert on public.trip_plan_stops
for insert to authenticated
with check (
  exists (
    select 1
    from public.trip_plans p
    where p.id = trip_plan_stops.plan_id
      and p.created_by = auth.uid()
  )
);

drop policy if exists trip_plan_stops_update on public.trip_plan_stops;
create policy trip_plan_stops_update on public.trip_plan_stops
for update to authenticated
using (
  exists (
    select 1
    from public.trip_plans p
    where p.id = trip_plan_stops.plan_id
      and p.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.trip_plans p
    where p.id = trip_plan_stops.plan_id
      and p.created_by = auth.uid()
  )
);

drop policy if exists trip_plan_stops_delete on public.trip_plan_stops;
create policy trip_plan_stops_delete on public.trip_plan_stops
for delete to authenticated
using (
  exists (
    select 1
    from public.trip_plans p
    where p.id = trip_plan_stops.plan_id
      and p.created_by = auth.uid()
  )
);

drop policy if exists ai_plan_generations_select_own on public.ai_plan_generations;
create policy ai_plan_generations_select_own on public.ai_plan_generations
for select to authenticated
using (created_by = auth.uid());

drop policy if exists ai_plan_generations_insert_own on public.ai_plan_generations;
create policy ai_plan_generations_insert_own on public.ai_plan_generations
for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists ai_plan_generations_delete_own on public.ai_plan_generations;
create policy ai_plan_generations_delete_own on public.ai_plan_generations
for delete to authenticated
using (created_by = auth.uid());

create trigger trg_trip_plans_updated_at
  before update on public.trip_plans
  for each row execute function public.set_updated_at();

create trigger trg_trip_plan_stops_updated_at
  before update on public.trip_plan_stops
  for each row execute function public.set_updated_at();

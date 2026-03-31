alter table public.trip_plan_stops
  add column if not exists map_source text
  check (map_source in ('auto', 'manual'));

alter table public.trip_plan_stops
  add column if not exists map_enabled boolean not null default false,
  add column if not exists map_label text;

create index if not exists idx_trip_plan_stops_map_enabled on public.trip_plan_stops(plan_id, map_enabled);

alter table public.photos
  add column if not exists camera_make text,
  add column if not exists camera_model text,
  add column if not exists lens_model text,
  add column if not exists f_number numeric,
  add column if not exists exposure_time text,
  add column if not exists iso integer,
  add column if not exists focal_length numeric,
  add column if not exists taken_at timestamptz,
  add column if not exists orientation integer,
  add column if not exists gps_lat double precision,
  add column if not exists gps_lng double precision,
  add column if not exists has_gps boolean not null default false;

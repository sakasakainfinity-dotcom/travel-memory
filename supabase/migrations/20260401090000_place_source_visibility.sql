alter table public.places
  add column if not exists source_visibility text
  check (source_visibility in ('public', 'private'));

update public.places
set source_visibility = 'public'
where visibility = 'private'
  and source_place_id is not null
  and source_visibility is null;

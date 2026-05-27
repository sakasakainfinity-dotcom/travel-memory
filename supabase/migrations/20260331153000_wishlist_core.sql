alter table public.places
  add column if not exists status text not null default 'visited' check (status in ('wishlist', 'visited')),
  add column if not exists source_place_id uuid references public.places(id) on delete set null,
  add column if not exists ai_summary text,
  add column if not exists ai_tips text,
  add column if not exists ai_generated_at timestamptz;

update public.places p
set status = case
  when exists (select 1 from public.photos ph where ph.place_id = p.id) then 'visited'
  else 'wishlist'
end
where p.status is null or p.status not in ('wishlist','visited');

create unique index if not exists idx_places_private_source_place_unique
  on public.places(space_id, source_place_id)
  where source_place_id is not null and visibility = 'private';

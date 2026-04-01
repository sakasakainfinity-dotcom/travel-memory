create table if not exists public.place_categories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint place_categories_name_length check (char_length(trim(name)) between 1 and 40)
);

create unique index if not exists idx_place_categories_space_id_name_unique
  on public.place_categories(space_id, lower(name));

alter table public.places
  add column if not exists place_category_id uuid references public.place_categories(id) on delete set null;

create index if not exists idx_places_place_category_id on public.places(place_category_id);

alter table public.place_categories enable row level security;

drop policy if exists place_categories_select_member on public.place_categories;
create policy place_categories_select_member on public.place_categories
for select to authenticated
using (
  exists (
    select 1
    from public.space_members sm
    where sm.space_id = place_categories.space_id
      and sm.user_id = auth.uid()
  )
);

drop policy if exists place_categories_insert_member on public.place_categories;
create policy place_categories_insert_member on public.place_categories
for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.space_members sm
    where sm.space_id = place_categories.space_id
      and sm.user_id = auth.uid()
  )
);

-- photoMapper unified municipality world

alter table public.profiles
  add column if not exists total_points bigint not null default 0,
  add column if not exists rank_key text,
  add column if not exists opened_municipality_count integer not null default 0,
  add column if not exists opened_prefecture_count integer not null default 0;

alter table public.places
  add column if not exists prefecture_name text,
  add column if not exists municipality_name text,
  add column if not exists municipality_key text,
  add column if not exists municipality_code text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists status text not null default 'active',
  add column if not exists first_explorer_user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_places_municipality_key on public.places(municipality_key);

create table if not exists public.municipality_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  municipality_key text not null,
  prefecture_name text not null,
  municipality_name text not null,
  first_post_id uuid references public.places(id) on delete set null,
  post_count_in_municipality integer not null default 0,
  municipality_rank_key text not null default 'starter',
  is_first_explorer boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, municipality_key)
);

create table if not exists public.municipality_stats (
  municipality_key text primary key,
  prefecture_name text not null,
  municipality_name text not null,
  total_post_count integer not null default 0,
  total_user_count integer not null default 0,
  first_post_id uuid references public.places(id) on delete set null,
  first_explorer_user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.place_flags
  add column if not exists municipality_key text;

update public.place_flags
set municipality_key = place_key
where municipality_key is null;

create index if not exists idx_place_flags_municipality_key on public.place_flags(municipality_key);

create or replace function public.resolve_municipality_rank(post_count integer)
returns text
language sql
immutable
as $$
  select case
    when post_count >= 10 then 'legend'
    when post_count >= 5 then 'expert'
    when post_count >= 2 then 'supporter'
    else 'starter'
  end;
$$;

create or replace function public.handle_place_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first boolean := false;
begin
  if new.municipality_key is null or new.created_by is null then
    return new;
  end if;

  if not exists (select 1 from public.municipality_stats ms where ms.municipality_key = new.municipality_key) then
    is_first := true;
    insert into public.municipality_stats (
      municipality_key,
      prefecture_name,
      municipality_name,
      total_post_count,
      total_user_count,
      first_post_id,
      first_explorer_user_id,
      updated_at
    ) values (
      new.municipality_key,
      coalesce(new.prefecture_name, '不明'),
      coalesce(new.municipality_name, '不明'),
      1,
      1,
      new.id,
      new.created_by,
      timezone('utc'::text, now())
    );
  else
    update public.municipality_stats
    set total_post_count = total_post_count + 1,
        total_user_count = (
          select count(distinct p.created_by)
          from public.places p
          where p.municipality_key = new.municipality_key
            and p.created_by is not null
        ),
        updated_at = timezone('utc'::text, now())
    where municipality_key = new.municipality_key;
  end if;

  insert into public.municipality_progress (
    user_id,
    municipality_key,
    prefecture_name,
    municipality_name,
    first_post_id,
    post_count_in_municipality,
    municipality_rank_key,
    is_first_explorer
  )
  values (
    new.created_by,
    new.municipality_key,
    coalesce(new.prefecture_name, '不明'),
    coalesce(new.municipality_name, '不明'),
    new.id,
    1,
    'starter',
    is_first
  )
  on conflict (user_id, municipality_key)
  do update set
    post_count_in_municipality = municipality_progress.post_count_in_municipality + 1,
    municipality_rank_key = public.resolve_municipality_rank(municipality_progress.post_count_in_municipality + 1),
    updated_at = timezone('utc'::text, now());

  update public.profiles
  set total_points = coalesce(total_points, 0) + 10
  where id = new.created_by;

  update public.profiles p
  set opened_municipality_count = (
      select count(*) from public.municipality_progress mp where mp.user_id = p.id
    ),
    opened_prefecture_count = (
      select count(distinct mp.prefecture_name) from public.municipality_progress mp where mp.user_id = p.id
    )
  where p.id = new.created_by;

  if is_first then
    update public.places set first_explorer_user_id = new.created_by where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_handle_place_created on public.places;
create trigger trg_handle_place_created
after insert on public.places
for each row
execute function public.handle_place_created();

create or replace function public.handle_post_like_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles p
    set total_points = coalesce(total_points, 0) + 1
    from public.places pl
    where pl.id = new.post_id
      and p.id = pl.created_by;
    return new;
  elsif tg_op = 'DELETE' then
    update public.profiles p
    set total_points = greatest(0, coalesce(total_points, 0) - 1)
    from public.places pl
    where pl.id = old.post_id
      and p.id = pl.created_by;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_handle_post_like_points on public.post_likes;
create trigger trg_handle_post_like_points
after insert or delete on public.post_likes
for each row
execute function public.handle_post_like_points();

alter table public.municipality_progress enable row level security;
alter table public.municipality_stats enable row level security;

-- places: public read, auth write-own
create policy if not exists places_select_public on public.places
for select
using (visibility = 'public');

create policy if not exists places_insert_authenticated on public.places
for insert to authenticated
with check (created_by = auth.uid());

create policy if not exists places_update_own on public.places
for update to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy if not exists places_delete_own on public.places
for delete to authenticated
using (created_by = auth.uid());

-- photos: public read, own write/delete through place ownership
create policy if not exists photos_select_public on public.photos
for select
using (true);

create policy if not exists photos_insert_owner on public.photos
for insert to authenticated
with check (
  exists (
    select 1 from public.places p
    where p.id = photos.place_id
      and p.created_by = auth.uid()
  )
);

create policy if not exists photos_delete_owner on public.photos
for delete to authenticated
using (
  exists (
    select 1 from public.places p
    where p.id = photos.place_id
      and p.created_by = auth.uid()
  )
);

create policy if not exists post_likes_rw_self on public.post_likes
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy if not exists municipality_progress_select_public on public.municipality_progress
for select
using (true);

create policy if not exists municipality_progress_rw_self on public.municipality_progress
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy if not exists municipality_stats_select_public on public.municipality_stats
for select
using (true);

-- backfill municipality based on old place_key link
update public.places p
set municipality_key = coalesce(p.municipality_key, pf.municipality_key),
    municipality_name = coalesce(p.municipality_name, split_part(pf.municipality_key, '::', 2)),
    prefecture_name = coalesce(p.prefecture_name, split_part(pf.municipality_key, '::', 1))
from public.place_flags pf
where p.municipality_key is null
  and pf.place_key is not null
  and pf.municipality_key is not null;

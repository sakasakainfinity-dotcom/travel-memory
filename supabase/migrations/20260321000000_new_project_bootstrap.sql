-- New Supabase bootstrap for PhotoMapper / travel-memory
-- Goal: rebuild the app on a fresh Supabase project without depending on the restricted legacy project.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  display_name text,
  avatar_url text,
  is_premium boolean not null default false,
  premium_since timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null default 'My Space',
  type text not null default 'solo',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.space_members (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (space_id, user_id)
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  client_request_id text,
  title text,
  memo text,
  lat double precision not null,
  lng double precision not null,
  visited_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  visibility text not null default 'private' check (visibility in ('public', 'private', 'pair')),
  taken_at timestamptz,
  camera_make text,
  camera_model text,
  f_number numeric,
  exposure_time text,
  iso integer,
  focal_length numeric,
  has_gps boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (space_id, client_request_id)
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references public.spaces(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  file_url text,
  url text,
  storage_path text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (post_id, user_id)
);

create table if not exists public.place_flags (
  id uuid primary key default gen_random_uuid(),
  place_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('want', 'visited')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (place_key, user_id, kind)
);

create table if not exists public.place_reactions (
  id uuid primary key default gen_random_uuid(),
  place_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (place_key, user_id, reaction)
);

create table if not exists public.space_shares (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null unique references public.spaces(id) on delete cascade,
  share_token text not null unique,
  enabled boolean not null default true,
  include_private boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.pairs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text,
  invite_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.pair_members (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (pair_id, user_id)
);

create table if not exists public.pair_invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  used_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default timezone('utc'::text, now()) + interval '7 days',
  used_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.pilgrimage_missions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.pilgrimage_spots (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.pilgrimage_missions(id) on delete cascade,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.pilgrimage_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  spot_id uuid not null references public.pilgrimage_spots(id) on delete cascade,
  post_id uuid references public.places(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, spot_id)
);

create table if not exists public.spot_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  is_public boolean not null default false,
  share_slug text not null unique,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.spot_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.spot_collections(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (collection_id, place_id)
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_type text not null,
  status text not null default 'active',
  stripe_session_id text,
  stripe_subscription_id text,
  amount integer,
  currency text default 'jpy',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  email text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  place_id uuid references public.places(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  title text,
  memo text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_space_members_user_id on public.space_members(user_id);
create index if not exists idx_places_space_id_created_at on public.places(space_id, created_at desc);
create index if not exists idx_places_visibility_created_at on public.places(visibility, created_at desc);
create index if not exists idx_photos_place_id on public.photos(place_id);
create index if not exists idx_post_likes_post_id on public.post_likes(post_id);
create index if not exists idx_place_flags_place_key on public.place_flags(place_key);
create index if not exists idx_pair_members_user_id on public.pair_members(user_id);
create index if not exists idx_pilgrimage_spots_mission_id on public.pilgrimage_spots(mission_id);
create index if not exists idx_pilgrimage_progress_user_spot on public.pilgrimage_progress(user_id, spot_id);
create index if not exists idx_spot_collection_items_collection_id_sort_order on public.spot_collection_items(collection_id, sort_order);

create or replace function public.is_space_member(target_space_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.space_members m
    where m.space_id = target_space_id
      and m.user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.places enable row level security;
alter table public.photos enable row level security;
alter table public.post_likes enable row level security;
alter table public.place_flags enable row level security;
alter table public.place_reactions enable row level security;
alter table public.space_shares enable row level security;
alter table public.pairs enable row level security;
alter table public.pair_members enable row level security;
alter table public.pair_invites enable row level security;
alter table public.pilgrimage_missions enable row level security;
alter table public.pilgrimage_spots enable row level security;
alter table public.pilgrimage_progress enable row level security;
alter table public.spot_collections enable row level security;
alter table public.spot_collection_items enable row level security;
alter table public.purchases enable row level security;
alter table public.feedbacks enable row level security;
alter table public.memories enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated
using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert to authenticated
with check (id = auth.uid());

drop policy if exists spaces_select_member_or_public_seed on public.spaces;
create policy spaces_select_member_or_public_seed on public.spaces
for select
using (
  public.is_space_member(id)
  or (name = 'public-space' and owner_id is null)
);

drop policy if exists spaces_insert_owner on public.spaces;
create policy spaces_insert_owner on public.spaces
for insert to authenticated
with check (owner_id = auth.uid() or owner_id is null);

drop policy if exists spaces_update_owner on public.spaces;
create policy spaces_update_owner on public.spaces
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists space_members_select_own_space on public.space_members;
create policy space_members_select_own_space on public.space_members
for select to authenticated
using (user_id = auth.uid() or public.is_space_member(space_id));

drop policy if exists space_members_insert_self_or_owner on public.space_members;
create policy space_members_insert_self_or_owner on public.space_members
for insert to authenticated
with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.spaces s
    where s.id = space_members.space_id
      and s.owner_id = auth.uid()
  )
);

drop policy if exists space_members_update_owner on public.space_members;
create policy space_members_update_owner on public.space_members
for update to authenticated
using (
  exists (
    select 1 from public.spaces s
    where s.id = space_members.space_id
      and s.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.spaces s
    where s.id = space_members.space_id
      and s.owner_id = auth.uid()
  )
);

drop policy if exists space_members_delete_owner_or_self on public.space_members;
create policy space_members_delete_owner_or_self on public.space_members
for delete to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.spaces s
    where s.id = space_members.space_id
      and s.owner_id = auth.uid()
  )
);

drop policy if exists places_select_public_or_member on public.places;
create policy places_select_public_or_member on public.places
for select
using (
  visibility = 'public'
  or public.is_space_member(space_id)
);

drop policy if exists places_insert_member on public.places;
create policy places_insert_member on public.places
for insert to authenticated
with check (
  public.is_space_member(space_id)
  and created_by = auth.uid()
);

drop policy if exists places_update_member on public.places;
create policy places_update_member on public.places
for update to authenticated
using (public.is_space_member(space_id))
with check (public.is_space_member(space_id));

drop policy if exists places_delete_member on public.places;
create policy places_delete_member on public.places
for delete to authenticated
using (public.is_space_member(space_id));

drop policy if exists photos_select_public_or_member on public.photos;
create policy photos_select_public_or_member on public.photos
for select
using (
  exists (
    select 1
    from public.places p
    where p.id = photos.place_id
      and (p.visibility = 'public' or public.is_space_member(p.space_id))
  )
);

drop policy if exists photos_insert_member on public.photos;
create policy photos_insert_member on public.photos
for insert to authenticated
with check (
  exists (
    select 1
    from public.places p
    where p.id = photos.place_id
      and public.is_space_member(p.space_id)
  )
);

drop policy if exists photos_delete_member on public.photos;
create policy photos_delete_member on public.photos
for delete to authenticated
using (
  exists (
    select 1
    from public.places p
    where p.id = photos.place_id
      and public.is_space_member(p.space_id)
  )
);

drop policy if exists post_likes_public_read on public.post_likes;
create policy post_likes_public_read on public.post_likes
for select
using (true);

drop policy if exists post_likes_insert_self on public.post_likes;
create policy post_likes_insert_self on public.post_likes
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists post_likes_delete_self on public.post_likes;
create policy post_likes_delete_self on public.post_likes
for delete to authenticated
using (user_id = auth.uid());

drop policy if exists place_flags_public_read on public.place_flags;
create policy place_flags_public_read on public.place_flags
for select
using (true);

drop policy if exists place_flags_insert_self on public.place_flags;
create policy place_flags_insert_self on public.place_flags
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists place_flags_delete_self on public.place_flags;
create policy place_flags_delete_self on public.place_flags
for delete to authenticated
using (user_id = auth.uid());

drop policy if exists place_reactions_public_read on public.place_reactions;
create policy place_reactions_public_read on public.place_reactions
for select
using (true);

drop policy if exists place_reactions_insert_self on public.place_reactions;
create policy place_reactions_insert_self on public.place_reactions
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists place_reactions_delete_self on public.place_reactions;
create policy place_reactions_delete_self on public.place_reactions
for delete to authenticated
using (user_id = auth.uid());

drop policy if exists space_shares_owner_all on public.space_shares;
create policy space_shares_owner_all on public.space_shares
for all to authenticated
using (
  exists (
    select 1 from public.spaces s
    where s.id = space_shares.space_id
      and s.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.spaces s
    where s.id = space_shares.space_id
      and s.owner_id = auth.uid()
  )
);

drop policy if exists pair_invites_insert_by_member on public.pair_invites;
create policy pair_invites_insert_by_member on public.pair_invites
for insert to authenticated
with check (
  created_by = auth.uid()
  and public.is_space_member(space_id)
);

drop policy if exists pair_invites_select_by_member on public.pair_invites;
create policy pair_invites_select_by_member on public.pair_invites
for select to authenticated
using (
  created_by = auth.uid()
  or public.is_space_member(space_id)
);

drop policy if exists pair_invites_update_redeem_once on public.pair_invites;
create policy pair_invites_update_redeem_once on public.pair_invites
for update to authenticated
using (
  used_by is null
  and expires_at > timezone('utc'::text, now())
)
with check (
  used_by = auth.uid()
  and used_at is not null
  and expires_at > timezone('utc'::text, now())
);

drop policy if exists pairs_select_member on public.pairs;
create policy pairs_select_member on public.pairs
for select to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.pair_members pm
    where pm.pair_id = pairs.id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists pair_members_select_member on public.pair_members;
create policy pair_members_select_member on public.pair_members
for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.pair_members pm
    where pm.pair_id = pair_members.pair_id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists pilgrimage_missions_read_authenticated on public.pilgrimage_missions;
create policy pilgrimage_missions_read_authenticated on public.pilgrimage_missions
for select to authenticated
using (true);

drop policy if exists pilgrimage_spots_read_authenticated on public.pilgrimage_spots;
create policy pilgrimage_spots_read_authenticated on public.pilgrimage_spots
for select to authenticated
using (true);

drop policy if exists pilgrimage_progress_read_my on public.pilgrimage_progress;
create policy pilgrimage_progress_read_my on public.pilgrimage_progress
for select to authenticated
using (user_id = auth.uid());

drop policy if exists pilgrimage_progress_upsert_my_insert on public.pilgrimage_progress;
create policy pilgrimage_progress_upsert_my_insert on public.pilgrimage_progress
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists pilgrimage_progress_upsert_my_update on public.pilgrimage_progress;
create policy pilgrimage_progress_upsert_my_update on public.pilgrimage_progress
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists spot_collections_owner_all on public.spot_collections;
create policy spot_collections_owner_all on public.spot_collections
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists spot_collections_public_read on public.spot_collections;
create policy spot_collections_public_read on public.spot_collections
for select
using (is_public = true or user_id = auth.uid());

drop policy if exists spot_collection_items_owner_all on public.spot_collection_items;
create policy spot_collection_items_owner_all on public.spot_collection_items
for all to authenticated
using (
  exists (
    select 1 from public.spot_collections c
    where c.id = spot_collection_items.collection_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.spot_collections c
    where c.id = spot_collection_items.collection_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists spot_collection_items_public_read on public.spot_collection_items;
create policy spot_collection_items_public_read on public.spot_collection_items
for select
using (
  exists (
    select 1 from public.spot_collections c
    where c.id = spot_collection_items.collection_id
      and (c.is_public = true or c.user_id = auth.uid())
  )
);

drop policy if exists purchases_owner_all on public.purchases;
create policy purchases_owner_all on public.purchases
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists feedbacks_anyone_insert on public.feedbacks;
create policy feedbacks_anyone_insert on public.feedbacks
for insert
with check (true);

drop policy if exists feedbacks_owner_read on public.feedbacks;
create policy feedbacks_owner_read on public.feedbacks
for select to authenticated
using (user_id = auth.uid());

drop policy if exists memories_member_all on public.memories;
create policy memories_member_all on public.memories
for all to authenticated
using (public.is_space_member(space_id))
with check (public.is_space_member(space_id));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

do $$
begin
  insert into storage.buckets (id, name, public)
  values ('photos', 'photos', true)
  on conflict (id) do update set public = excluded.public;
exception
  when undefined_table then
    raise notice 'storage.buckets not available in this environment';
end $$;

drop policy if exists photos_public_read on storage.objects;
create policy photos_public_read on storage.objects
for select
using (bucket_id = 'photos');

drop policy if exists photos_member_upload on storage.objects;
create policy photos_member_upload on storage.objects
for insert to authenticated
with check (
  bucket_id = 'photos'
  and exists (
    select 1
    from public.places p
    where p.id::text = split_part(name, '/', 1)
      and public.is_space_member(p.space_id)
  )
);

drop policy if exists photos_member_delete on storage.objects;
create policy photos_member_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'photos'
  and exists (
    select 1
    from public.places p
    where p.id::text = split_part(name, '/', 1)
      and public.is_space_member(p.space_id)
  )
);

create or replace function public.create_pair_group(p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pair_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.pairs (owner_id, name)
  values (v_uid, nullif(trim(coalesce(p_name, '')), ''))
  returning id into v_pair_id;

  insert into public.pair_members (pair_id, user_id, role)
  values (v_pair_id, v_uid, 'owner')
  on conflict (pair_id, user_id) do nothing;

  return v_pair_id;
end;
$$;

grant execute on function public.create_pair_group(text) to authenticated;

create or replace function public.get_my_pairs()
returns table (
  pair_group_id uuid,
  name text,
  owner_id uuid,
  invite_token text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name, p.owner_id, p.invite_token
  from public.pairs p
  join public.pair_members pm on pm.pair_id = p.id
  where pm.user_id = auth.uid()
  order by p.created_at desc;
$$;

grant execute on function public.get_my_pairs() to authenticated;

create or replace function public.pair_join_with_token(p_token text, p_role text default 'member')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pair_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select id into v_pair_id
  from public.pairs
  where invite_token = p_token;

  if v_pair_id is null then
    raise exception 'invalid token';
  end if;

  insert into public.pair_members (pair_id, user_id, role)
  values (v_pair_id, v_uid, coalesce(nullif(trim(p_role), ''), 'member'))
  on conflict (pair_id, user_id) do nothing;

  return v_pair_id;
end;
$$;

grant execute on function public.pair_join_with_token(text, text) to authenticated;

create or replace function public.public_feed(
  q text default null,
  cursor timestamptz default null,
  page_size integer default 20,
  viewer uuid default null
)
returns table (
  id uuid,
  title text,
  memo text,
  created_by_name text,
  created_at timestamptz,
  photo_urls text[],
  like_count bigint,
  liked_by_me boolean
)
language sql
security definer
set search_path = public
as $$
  with filtered_places as (
    select p.id, p.title, p.memo, p.created_by_name, p.created_at
    from public.places p
    where p.visibility = 'public'
      and (
        q is null
        or q = ''
        or coalesce(p.title, '') ilike '%' || q || '%'
        or coalesce(p.memo, '') ilike '%' || q || '%'
        or coalesce(p.created_by_name, '') ilike '%' || q || '%'
      )
      and (cursor is null or p.created_at < cursor)
    order by p.created_at desc
    limit greatest(coalesce(page_size, 20), 1)
  ),
  photo_agg as (
    select ph.place_id, array_remove(array_agg(coalesce(ph.file_url, ph.url) order by ph.created_at asc), null) as photo_urls
    from public.photos ph
    where ph.place_id in (select id from filtered_places)
    group by ph.place_id
  ),
  like_agg as (
    select pl.post_id, count(*)::bigint as like_count
    from public.post_likes pl
    where pl.post_id in (select id from filtered_places)
    group by pl.post_id
  )
  select
    fp.id,
    fp.title,
    fp.memo,
    fp.created_by_name,
    fp.created_at,
    coalesce(pa.photo_urls, '{}'::text[]) as photo_urls,
    coalesce(la.like_count, 0) as like_count,
    exists (
      select 1
      from public.post_likes pl2
      where pl2.post_id = fp.id
        and pl2.user_id = viewer
    ) as liked_by_me
  from filtered_places fp
  left join photo_agg pa on pa.place_id = fp.id
  left join like_agg la on la.post_id = fp.id
  order by fp.created_at desc;
$$;

grant execute on function public.public_feed(text, timestamptz, integer, uuid) to anon, authenticated;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_spaces_updated_at
  before update on public.spaces
  for each row execute function public.set_updated_at();

create trigger trg_places_updated_at
  before update on public.places
  for each row execute function public.set_updated_at();

create trigger trg_space_shares_updated_at
  before update on public.space_shares
  for each row execute function public.set_updated_at();

create trigger trg_pairs_updated_at
  before update on public.pairs
  for each row execute function public.set_updated_at();

create trigger trg_pilgrimage_progress_updated_at
  before update on public.pilgrimage_progress
  for each row execute function public.set_updated_at();

create trigger trg_spot_collections_updated_at
  before update on public.spot_collections
  for each row execute function public.set_updated_at();

create trigger trg_purchases_updated_at
  before update on public.purchases
  for each row execute function public.set_updated_at();

create trigger trg_memories_updated_at
  before update on public.memories
  for each row execute function public.set_updated_at();

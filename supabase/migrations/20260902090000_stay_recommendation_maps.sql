-- Multi-property host-curated maps. Spots are reusable across stays; the join owns
-- the host's recommendation, ordering and featured state.
create table if not exists public.stays (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  subtitle text, description text, image_url text, logo_url text, address text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  is_published boolean not null default false,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null))
);

create table if not exists public.stay_spot_categories (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  slug text not null unique, sort_order integer not null default 0
);

create table if not exists public.stay_spots (
  id uuid primary key default gen_random_uuid(), name text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  address text, google_maps_url text, image_url text, description text,
  distance_label text, walking_time text, driving_time text, business_hours text,
  closed_days text, website_url text, instagram_url text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.stay_spot_category_links (
  spot_id uuid not null references public.stay_spots(id) on delete cascade,
  category_id uuid not null references public.stay_spot_categories(id) on delete cascade,
  primary key (spot_id, category_id)
);

create table if not exists public.stay_recommendations (
  stay_id uuid not null references public.stays(id) on delete cascade,
  spot_id uuid not null references public.stay_spots(id) on delete cascade,
  host_comment text not null check (char_length(host_comment) <= 1000),
  is_featured boolean not null default false, is_published boolean not null default true,
  sort_order integer not null default 0, created_at timestamptz not null default now(),
  primary key (stay_id, spot_id)
);

-- Reserved for curated local knowledge (not reviews or star ratings).
create table if not exists public.stay_spot_local_notes (
  id uuid primary key default gen_random_uuid(), spot_id uuid not null references public.stay_spots(id) on delete cascade,
  author_name text, body text not null check (char_length(body) <= 1000),
  is_published boolean not null default false, created_at timestamptz not null default now()
);

create table if not exists public.stay_map_events (
  id bigint generated always as identity primary key, stay_id uuid references public.stays(id) on delete cascade,
  spot_id uuid references public.stay_spots(id) on delete cascade,
  event_type text not null check (event_type in ('map_view','spot_view','google_maps_click')),
  occurred_at timestamptz not null default now()
);

insert into public.stay_spot_categories(name,slug,sort_order) values
 ('レストラン','restaurant',10),('カフェ','cafe',20),('観光','sightseeing',30),('スーパー','supermarket',40),
 ('コンビニ','convenience',50),('温泉','onsen',60),('お土産','souvenir',70),('雨の日','rainy-day',80),
 ('夜におすすめ','night',90),('子連れ','family',100),('その他','other',110)
on conflict (slug) do nothing;

-- The first property is ready for its initial 30–50 recommendations. It starts
-- unpublished so an administrator can confirm coordinates and copy before launch.
insert into public.stays(name,slug,subtitle,description,image_url,address,latitude,longitude,is_published)
values ('まちやど Motomachi','motomachi','宿主おすすめ 大子町MAP',
  'ごはん、観光、買い物など、まちやど宿主がおすすめする場所をまとめました。',
  '/motomachi.jpg','茨城県久慈郡大子町',36.7681,140.3507,false)
on conflict (slug) do nothing;

alter table public.stays enable row level security;
alter table public.stay_spots enable row level security;
alter table public.stay_spot_categories enable row level security;
alter table public.stay_spot_category_links enable row level security;
alter table public.stay_recommendations enable row level security;
alter table public.stay_spot_local_notes enable row level security;
alter table public.stay_map_events enable row level security;

create policy "published stays are public" on public.stays for select using (is_published or public.is_admin());
create policy "published spots are public" on public.stay_spots for select using (is_published or public.is_admin());
create policy "categories are public" on public.stay_spot_categories for select using (true);
create policy "spot category links are public" on public.stay_spot_category_links for select using (true);
create policy "published recommendations are public" on public.stay_recommendations for select using (is_published or public.is_admin());
create policy "published local notes are public" on public.stay_spot_local_notes for select using (is_published or public.is_admin());
create policy "anonymous map analytics" on public.stay_map_events for insert with check (event_type in ('map_view','spot_view','google_maps_click'));

create policy "admins manage stays" on public.stays for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage stay spots" on public.stay_spots for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage categories" on public.stay_spot_categories for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage spot category links" on public.stay_spot_category_links for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage recommendations" on public.stay_recommendations for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage local notes" on public.stay_spot_local_notes for all using (public.is_admin()) with check (public.is_admin());
create policy "admins read map analytics" on public.stay_map_events for select using (public.is_admin());

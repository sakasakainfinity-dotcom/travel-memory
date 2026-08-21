-- Stay coupon catalogue and immutable redemption history.
create table if not exists public.coupons (
  coupon_id uuid primary key default gen_random_uuid(),
  title text not null,
  discount_amount integer not null check (discount_amount > 0),
  minimum_spend integer not null default 0 check (minimum_spend >= 0),
  valid_from timestamptz,
  valid_to timestamptz,
  active boolean not null default true,
  constraint coupon_dates_ordered check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create table if not exists public.coupon_stores (
  store_id uuid primary key default gen_random_uuid(),
  store_name text not null,
  store_image text,
  active boolean not null default true,
  recruiting boolean not null default false
);

create table if not exists public.coupon_usages (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.stays(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  coupon_id uuid not null references public.coupons(coupon_id) on delete restrict,
  store_id uuid not null references public.coupon_stores(store_id) on delete restrict,
  discount_amount integer not null check (discount_amount > 0),
  used_at timestamptz not null default now(),
  constraint coupon_usage_once_per_reservation unique (reservation_id)
);

alter table public.coupons enable row level security;
alter table public.coupon_stores enable row level security;
alter table public.coupon_usages enable row level security;

-- Writes are intentionally service-role only. Members can read their own persisted history.
create policy coupon_catalogue_read on public.coupons for select to authenticated using (active);
create policy coupon_store_read on public.coupon_stores for select to authenticated using (active);
create policy coupon_usage_read_own on public.coupon_usages for select to authenticated using (user_id = auth.uid());

insert into public.coupons (coupon_id,title,discount_amount,minimum_spend,active)
values ('50000000-0000-4000-8000-000000000001','まちやどMotomachi 宿泊者限定クーポン',500,3000,true)
on conflict (coupon_id) do update set title=excluded.title,discount_amount=excluded.discount_amount,minimum_spend=excluded.minimum_spend,active=excluded.active;

insert into public.coupon_stores (store_id,store_name,store_image,active,recruiting)
values ('50000000-0000-4000-8000-000000000002','まちやどMotomachi','/motomachi.jpg',true,false)
on conflict (store_id) do update set store_name=excluded.store_name,store_image=excluded.store_image,active=excluded.active,recruiting=excluded.recruiting;

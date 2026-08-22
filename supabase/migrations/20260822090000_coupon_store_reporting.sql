-- Private partner access metadata and indexes for coupon usage reporting.
create extension if not exists pgcrypto;

alter table public.coupon_stores
  add column if not exists partner_token text,
  add column if not exists pin_hash text;

create unique index if not exists coupon_stores_partner_token_key
  on public.coupon_stores (partner_token) where partner_token is not null;
create index if not exists coupon_usages_store_used_at_idx
  on public.coupon_usages (store_id, used_at desc);

create table if not exists public.coupon_partner_pin_attempts (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.coupon_stores(store_id) on delete cascade,
  client_key_hash text not null,
  succeeded boolean not null default false,
  attempted_at timestamptz not null default now()
);
create index if not exists coupon_partner_pin_attempts_recent_idx
  on public.coupon_partner_pin_attempts (store_id, client_key_hash, attempted_at desc);
alter table public.coupon_partner_pin_attempts enable row level security;

-- The API calls this with the service role. The hash never leaves Postgres.
create or replace function public.verify_coupon_store_pin(target_store_id uuid, candidate_pin text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    (select pin_hash is not null and pin_hash = crypt(candidate_pin, pin_hash)
       from public.coupon_stores
      where store_id = target_store_id and active),
    false
  );
$$;
revoke all on function public.verify_coupon_store_pin(uuid, text) from public, anon, authenticated;
grant execute on function public.verify_coupon_store_pin(uuid, text) to service_role;

-- Provision each shop outside source control, for example:
-- update public.coupon_stores
-- set partner_token = encode(gen_random_bytes(24), 'hex'),
--     pin_hash = crypt('<PIN>', gen_salt('bf', 12))
-- where store_id = '<store uuid>';

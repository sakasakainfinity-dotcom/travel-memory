-- Shared invite-only membership and service entitlements.
create table if not exists public.member_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  admin_note text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
create unique index if not exists member_accounts_email_lower_key on public.member_accounts (lower(email));

create table if not exists public.stays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.member_accounts(user_id) on delete cascade,
  check_in_at timestamptz not null,
  check_out_at timestamptz not null,
  reservation_source text not null default 'official' check (reservation_source in ('official')),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint stay_dates_ordered check (check_out_at > check_in_at)
);

create table if not exists public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.member_accounts(user_id) on delete cascade,
  entitlement_type text not null check (entitlement_type in ('if_then_bingo', 'stay_coupon')),
  valid_from timestamptz,
  valid_until timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  stay_id uuid references public.stays(id) on delete set null,
  constraint entitlement_dates_ordered check (valid_until is null or valid_from is null or valid_until > valid_from),
  unique (user_id, entitlement_type)
);

alter table public.member_accounts enable row level security;
alter table public.stays enable row level security;
alter table public.user_entitlements enable row level security;

create or replace function public.has_entitlement(kind text, at_time timestamptz default now())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from member_accounts m join user_entitlements e on e.user_id = m.user_id
    where m.user_id = auth.uid() and m.status = 'active' and e.entitlement_type = kind
      and e.active and (e.valid_from is null or e.valid_from <= at_time)
      and (e.valid_until is null or e.valid_until >= at_time)
  )
$$;
grant execute on function public.has_entitlement(text, timestamptz) to authenticated;

create policy member_read_self on public.member_accounts for select to authenticated
using (user_id = auth.uid() or public.is_admin());
create policy member_admin_all on public.member_accounts for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy stays_read_self on public.stays for select to authenticated
using (user_id = auth.uid() or public.is_admin());
create policy stays_admin_all on public.stays for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy entitlement_read_self on public.user_entitlements for select to authenticated
using (user_id = auth.uid() or public.is_admin());
create policy entitlement_admin_all on public.user_entitlements for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Access to If Then Bingo data is enforced by Postgres, not only by the UI.
drop policy if exists habit_bingos_own on public.habit_bingos;
create policy habit_bingos_entitled on public.habit_bingos for all to authenticated
using (user_id = auth.uid() and public.has_entitlement('if_then_bingo'))
with check (user_id = auth.uid() and public.has_entitlement('if_then_bingo'));
drop policy if exists habits_own on public.habits;
create policy habits_entitled on public.habits for all to authenticated
using (public.has_entitlement('if_then_bingo') and exists(select 1 from public.habit_bingos b where b.id=habit_bingo_id and b.user_id=auth.uid()))
with check (public.has_entitlement('if_then_bingo') and exists(select 1 from public.habit_bingos b where b.id=habit_bingo_id and b.user_id=auth.uid()));
drop policy if exists logs_own on public.habit_logs;
create policy logs_entitled on public.habit_logs for all to authenticated
using (user_id=auth.uid() and public.has_entitlement('if_then_bingo'))
with check (user_id=auth.uid() and public.has_entitlement('if_then_bingo') and exists(select 1 from public.habits h join public.habit_bingos b on b.id=h.habit_bingo_id where h.id=habit_id and b.user_id=auth.uid()));
drop policy if exists reward_definitions_own on public.reward_definitions;
create policy reward_definitions_entitled on public.reward_definitions for all to authenticated
using (public.has_entitlement('if_then_bingo') and exists(select 1 from public.habit_bingos b where b.id=habit_bingo_id and b.user_id=auth.uid()))
with check (public.has_entitlement('if_then_bingo') and exists(select 1 from public.habit_bingos b where b.id=habit_bingo_id and b.user_id=auth.uid()));
drop policy if exists reward_redemptions_read_own on public.reward_redemptions;
create policy reward_redemptions_entitled on public.reward_redemptions for select to authenticated
using (user_id=auth.uid() and public.has_entitlement('if_then_bingo'));

-- Keep a useful login timestamp without trusting the browser to update another user.
create or replace function public.touch_member_login()
returns void language sql security definer set search_path=public as $$
  update member_accounts set last_login_at=now() where user_id=auth.uid()
$$;
grant execute on function public.touch_member_login() to authenticated;

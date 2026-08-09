-- Daily HabitBingo rewards. Earned points remain derived from ALL CLEAR days;
-- redemptions are immutable ledger entries so a past-day edit cannot erase spend.
create table public.reward_definitions (
  id uuid primary key default gen_random_uuid(),
  habit_bingo_id uuid not null references public.habit_bingos(id) on delete cascade,
  description text not null check (char_length(btrim(description)) between 1 and 100),
  required_points integer not null check (required_points > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  habit_bingo_id uuid not null references public.habit_bingos(id) on delete restrict,
  reward_id uuid not null references public.reward_definitions(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  points_used integer not null check (points_used > 0),
  reward_description text not null,
  redeemed_at timestamptz not null default now()
);

create index reward_definitions_bingo_idx on public.reward_definitions(habit_bingo_id);
create index reward_redemptions_bingo_user_idx on public.reward_redemptions(habit_bingo_id, user_id);
alter table public.reward_definitions enable row level security;
alter table public.reward_redemptions enable row level security;

create policy reward_definitions_own on public.reward_definitions for all to authenticated
using (exists (select 1 from public.habit_bingos b where b.id = habit_bingo_id and b.user_id = auth.uid()))
with check (exists (select 1 from public.habit_bingos b where b.id = habit_bingo_id and b.user_id = auth.uid()));

create policy reward_redemptions_read_own on public.reward_redemptions for select to authenticated
using (user_id = auth.uid() and exists (select 1 from public.habit_bingos b where b.id = habit_bingo_id and b.user_id = auth.uid()));

-- Redemption writes only pass through this function, which serializes requests and
-- checks the server-calculated balance immediately before writing the ledger row.
create or replace function public.redeem_habit_reward(p_reward_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_reward public.reward_definitions%rowtype;
  v_earned integer;
  v_spent integer;
  v_redemption uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select r.* into v_reward
  from public.reward_definitions r
  join public.habit_bingos b on b.id = r.habit_bingo_id
  where r.id = p_reward_id and b.user_id = v_user;
  if not found then raise exception 'reward not found'; end if;

  perform pg_advisory_xact_lock(hashtext(v_reward.habit_bingo_id::text));
  select count(*) into v_earned from (
    select l.date
    from public.habit_logs l
    join public.habits h on h.id = l.habit_id
    where h.habit_bingo_id = v_reward.habit_bingo_id and l.user_id = v_user and l.completed
    group by l.date
    having count(distinct l.habit_id) = 9
  ) complete_days;
  select coalesce(sum(points_used), 0) into v_spent
  from public.reward_redemptions
  where habit_bingo_id = v_reward.habit_bingo_id and user_id = v_user;
  if v_earned - v_spent < v_reward.required_points then raise exception 'insufficient points'; end if;

  insert into public.reward_redemptions(habit_bingo_id, reward_id, user_id, points_used, reward_description)
  values(v_reward.habit_bingo_id, v_reward.id, v_user, v_reward.required_points, v_reward.description)
  returning id into v_redemption;
  return v_redemption;
end;
$$;

revoke all on function public.redeem_habit_reward(uuid) from public;
grant execute on function public.redeem_habit_reward(uuid) to authenticated;

-- Users may not leave their balance negative by undoing an ALL CLEAR day after redemption.
create or replace function public.prevent_negative_habit_balance()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_bingo uuid; v_user uuid; v_earned integer; v_spent integer;
begin
  select h.habit_bingo_id into v_bingo from public.habits h where h.id = old.habit_id;
  v_user := old.user_id;
  if old.completed and (tg_op = 'DELETE' or not new.completed) then
    select count(*) into v_earned from (
      select l.date from public.habit_logs l join public.habits h on h.id=l.habit_id
      where h.habit_bingo_id=v_bingo and l.user_id=v_user and l.completed
        and not (l.habit_id=old.habit_id and l.date=old.date)
      group by l.date having count(distinct l.habit_id)=9
    ) d;
    select coalesce(sum(points_used),0) into v_spent from public.reward_redemptions where habit_bingo_id=v_bingo and user_id=v_user;
    if v_earned < v_spent then raise exception 'redeemed points prevent undoing this ALL CLEAR'; end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
create trigger habit_logs_preserve_balance before delete or update on public.habit_logs
for each row execute function public.prevent_negative_habit_balance();

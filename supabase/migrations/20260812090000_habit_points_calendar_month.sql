-- Keep reward history, but calculate balances independently for each Tokyo calendar month.
create or replace function public.redeem_habit_reward(p_reward_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid(); v_reward public.reward_definitions%rowtype;
  v_month_start date := date_trunc('month', current_timestamp at time zone 'Asia/Tokyo')::date;
  v_earned integer; v_spent integer; v_redemption uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select r.* into v_reward from public.reward_definitions r join public.habit_bingos b on b.id = r.habit_bingo_id
  where r.id = p_reward_id and b.user_id = v_user;
  if not found then raise exception 'reward not found'; end if;
  perform pg_advisory_xact_lock(hashtext(v_reward.habit_bingo_id::text));
  select coalesce(sum(public.habit_points_for_count(completed_count)), 0)::integer into v_earned from (
    select count(distinct l.habit_id) completed_count from public.habit_logs l join public.habits h on h.id = l.habit_id
    where h.habit_bingo_id = v_reward.habit_bingo_id and l.user_id = v_user and l.completed
      and l.date >= v_month_start and l.date < (v_month_start + interval '1 month')::date group by l.date
  ) daily_counts;
  select coalesce(sum(points_used), 0) into v_spent from public.reward_redemptions
  where habit_bingo_id = v_reward.habit_bingo_id and user_id = v_user
    and (created_at at time zone 'Asia/Tokyo') >= v_month_start
    and (created_at at time zone 'Asia/Tokyo') < v_month_start + interval '1 month';
  if v_earned - v_spent < v_reward.required_points then raise exception 'insufficient points'; end if;
  insert into public.reward_redemptions(habit_bingo_id, reward_id, user_id, points_used, reward_description)
  values(v_reward.habit_bingo_id, v_reward.id, v_user, v_reward.required_points, v_reward.description) returning id into v_redemption;
  return v_redemption;
end;
$$;

create or replace function public.prevent_negative_habit_balance()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_bingo uuid; v_user uuid; v_month_start date; v_earned integer; v_spent integer;
begin
  select h.habit_bingo_id into v_bingo from public.habits h where h.id = old.habit_id;
  v_user := old.user_id; v_month_start := date_trunc('month', old.date)::date;
  if old.completed and (tg_op = 'DELETE' or not new.completed) then
    select coalesce(sum(public.habit_points_for_count(completed_count)), 0)::integer into v_earned from (
      select count(distinct l.habit_id) completed_count from public.habit_logs l join public.habits h on h.id = l.habit_id
      where h.habit_bingo_id = v_bingo and l.user_id = v_user and l.completed
        and l.date >= v_month_start and l.date < (v_month_start + interval '1 month')::date
        and not (l.habit_id = old.habit_id and l.date = old.date) group by l.date
    ) daily_counts;
    select coalesce(sum(points_used), 0) into v_spent from public.reward_redemptions
    where habit_bingo_id = v_bingo and user_id = v_user
      and (created_at at time zone 'Asia/Tokyo') >= v_month_start
      and (created_at at time zone 'Asia/Tokyo') < v_month_start + interval '1 month';
    if v_earned < v_spent then raise exception 'redeemed points prevent undoing this completion'; end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

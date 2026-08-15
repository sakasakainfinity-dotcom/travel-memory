-- Store the visible If/Then rule independently from the title used in history.
alter table public.habits add column if not exists if_condition text;
alter table public.habits add column if not exists then_action text;

update public.habits
set if_condition = '今日'
where if_condition is null or btrim(if_condition) = '';

update public.habits
set then_action = coalesce(nullif(btrim(description), ''), title)
where then_action is null or btrim(then_action) = '';

alter table public.habits alter column if_condition set not null;
alter table public.habits alter column then_action set not null;
alter table public.habits add constraint habits_if_condition_length check (char_length(if_condition) between 1 and 30);
alter table public.habits add constraint habits_then_action_length check (char_length(then_action) between 1 and 30);

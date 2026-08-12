-- Editable TownBingo cells and a board-defined user mission in the centre.
alter table public.bingo_items add column if not exists image_url text;
alter table public.bingo_items add column if not exists active boolean not null default true;

alter table public.bingo_items drop constraint if exists bingo_items_type_check;
alter table public.bingo_items add constraint bingo_items_type_check
  check (type in ('photo', 'quiz', 'user_mission'));

-- Existing progress keeps pointing at the same row; only the centre row changes role.
update public.bingo_items
set type = 'user_mission',
    title = 'YOUR MISSION',
    description = '今回の旅でやりたいことを自分で決めよう！',
    question = null,
    hint = null,
    correct_answers = null,
    spot_id = null,
    photo_required = false,
    active = true
where position = 12;

-- One transaction prevents the unique position constraint from being exposed while
-- an administrator moves a cell. The cell already at the destination is swapped.
create or replace function public.update_bingo_item(
  target_id uuid,
  next_position integer,
  next_title text,
  next_description text,
  next_image_url text,
  next_active boolean,
  next_type text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_item public.bingo_items%rowtype;
  displaced_id uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if next_position not between 0 and 24 then raise exception 'Position must be between 1 and 25'; end if;
  if next_position = 12 or next_type = 'user_mission' then raise exception 'The centre cell is reserved'; end if;

  select * into current_item from public.bingo_items where id = target_id for update;
  if not found or current_item.type = 'user_mission' then raise exception 'Cell cannot be edited'; end if;

  select id into displaced_id from public.bingo_items
    where bingo_id = current_item.bingo_id and position = next_position for update;
  if displaced_id is not null then
    update public.bingo_items set position = 25, sort_order = 25 where id = displaced_id;
  end if;
  update public.bingo_items set position = next_position, sort_order = next_position,
    title = next_title, description = nullif(next_description, ''),
    image_url = nullif(next_image_url, ''), active = next_active, type = next_type
    where id = target_id;
  if displaced_id is not null then
    update public.bingo_items set position = current_item.position, sort_order = current_item.position
      where id = displaced_id;
  end if;
end;
$$;

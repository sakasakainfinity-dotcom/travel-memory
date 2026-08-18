-- Let administrators configure the question, accepted answers and hint together
-- with the rest of an editable bingo cell.
drop function if exists public.update_bingo_item(uuid, integer, text, text, text, boolean, text);

create or replace function public.update_bingo_item(
  target_id uuid,
  next_position integer,
  next_title text,
  next_description text,
  next_image_url text,
  next_active boolean,
  next_type text,
  next_question text,
  next_hint text,
  next_correct_answers text[]
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
  if next_type = 'quiz' and (nullif(trim(next_question), '') is null or coalesce(array_length(next_correct_answers, 1), 0) = 0) then
    raise exception 'Quiz question and correct answer are required';
  end if;

  select * into current_item from public.bingo_items where id = target_id for update;
  if not found or current_item.type = 'user_mission' then raise exception 'Cell cannot be edited'; end if;

  select id into displaced_id from public.bingo_items
    where bingo_id = current_item.bingo_id and position = next_position for update;
  if displaced_id is not null then
    update public.bingo_items set position = 25, sort_order = 25 where id = displaced_id;
  end if;
  update public.bingo_items set position = next_position, sort_order = next_position,
    title = next_title, description = nullif(next_description, ''),
    image_url = nullif(next_image_url, ''), active = next_active, type = next_type,
    question = case when next_type = 'quiz' then nullif(trim(next_question), '') else null end,
    hint = case when next_type = 'quiz' then nullif(trim(next_hint), '') else null end,
    correct_answers = case when next_type = 'quiz' then next_correct_answers else null end
    where id = target_id;
  if displaced_id is not null then
    update public.bingo_items set position = current_item.position, sort_order = current_item.position
      where id = displaced_id;
  end if;
end;
$$;

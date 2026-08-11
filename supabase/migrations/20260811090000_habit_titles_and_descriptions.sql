-- Split the user-facing habit name into a short title and optional details.
-- Keep name populated for compatibility with older deployed clients.
alter table public.habits add column if not exists title text;
alter table public.habits add column if not exists description text;

update public.habits set title = left(name, 10) where title is null or btrim(title) = '';

alter table public.habits alter column title set not null;
alter table public.habits drop constraint if exists habits_title_length;
alter table public.habits add constraint habits_title_length check (char_length(title) between 1 and 10);
alter table public.habits drop constraint if exists habits_description_length;
alter table public.habits add constraint habits_description_length check (description is null or char_length(description) <= 30);

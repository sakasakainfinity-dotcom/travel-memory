alter table public.place_categories
  alter column created_by set default auth.uid();

drop policy if exists place_categories_insert_member on public.place_categories;
create policy place_categories_insert_member on public.place_categories
for insert to authenticated
with check (
  exists (
    select 1
    from public.space_members sm
    where sm.space_id = place_categories.space_id
      and sm.user_id = auth.uid()
  )
  and created_by = auth.uid()
);

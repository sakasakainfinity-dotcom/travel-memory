```sql


-- 追加: 自分がowner
create policy spaces_insert on public.spaces
for insert with check (owner_id = auth.uid());


-- space_members: 自分がそのspaceのメンバーならall可（MVP）
create policy space_members_rw on public.space_members
for all using (
exists (
select 1 from public.space_members m
where m.space_id = space_members.space_id and m.user_id = auth.uid()
)
) with check (
exists (
select 1 from public.space_members m
where m.space_id = space_members.space_id and m.user_id = auth.uid()
)
);


-- places / memories / photos
create policy places_rw on public.places
for all using (
exists (
select 1 from public.space_members m
where m.space_id = places.space_id and m.user_id = auth.uid()
)
) with check (
exists (
select 1 from public.space_members m
where m.space_id = places.space_id and m.user_id = auth.uid()
)
);


create policy memories_rw on public.memories
for all using (
exists (
select 1 from public.space_members m
where m.space_id = memories.space_id and m.user_id = auth.uid()
)
) with check (
exists (
select 1 from public.space_members m
where m.space_id = memories.space_id and m.user_id = auth.uid()
)
);


create policy photos_rw on public.photos
for all using (
exists (
select 1 from public.space_members m
where m.space_id = photos.space_id and m.user_id = auth.uid()
)
) with check (
exists (
select 1 from public.space_members m
where m.space_id = photos.space_id and m.user_id = auth.uid()
)
);
```
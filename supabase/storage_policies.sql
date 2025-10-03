```sql
-- 事前に Storage に `memories` バケットを作成してください
-- 画像のキー: space_id/place_id/memory_id/uuid.jpg


-- 読取: 該当spaceのメンバーのみ
create policy if not exists storage_read on storage.objects
for select using (
bucket_id = 'memories' and
exists (
select 1 from public.space_members m
where m.space_id = (split_part(storage.objects.name, '/', 1))::uuid
and m.user_id = auth.uid()
)
);


-- 書込: 認証済、かつspaceのメンバー
create policy if not exists storage_write on storage.objects
for insert to authenticated
with check (
bucket_id = 'memories' and
exists (
select 1 from public.space_members m
where m.space_id = (split_part(storage.objects.name, '/', 1))::uuid
and m.user_id = auth.uid()
)
);
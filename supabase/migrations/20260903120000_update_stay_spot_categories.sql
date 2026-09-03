-- Keep the stay map taxonomy focused on the six categories used by the editor.
-- Reuse existing slugs where possible so links for 観光・温泉・お土産 are preserved.
insert into public.stay_spot_categories (name, slug, sort_order) values
  ('飲食店', 'restaurant', 10),
  ('お土産', 'souvenir', 20),
  ('雑貨', 'general-goods', 30),
  ('観光', 'sightseeing', 40),
  ('温泉', 'onsen', 50),
  ('体験', 'experience', 60)
on conflict (slug) do update
set name = excluded.name,
    sort_order = excluded.sort_order;

delete from public.stay_spot_categories
where slug not in ('restaurant', 'souvenir', 'general-goods', 'sightseeing', 'onsen', 'experience');

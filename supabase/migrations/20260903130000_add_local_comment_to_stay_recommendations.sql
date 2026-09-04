-- Keep the host's recommendation and the local resident's perspective separately.
alter table public.stay_recommendations
  add column if not exists local_comment text
  check (local_comment is null or char_length(local_comment) <= 1000);

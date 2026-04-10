-- Phase1: remove currently-unused legacy tables (verified no app references in src/* as of 2026-04-10)
-- Safe target: tables not called from frontend/server runtime code.

begin;

-- 1) Legacy reaction table (replaced by post_likes + municipality flags)
drop table if exists public.place_reactions;

-- 2) AI trip plan generation cache table (feature not wired in current app runtime)
drop table if exists public.ai_plan_generations;

-- 3) Legacy feedback table (no active write/read path)
drop table if exists public.feedbacks;

commit;

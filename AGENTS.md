# AGENTS.md

## Server env / admin client rules
- Do not read `SUPABASE_SERVICE_ROLE_KEY` at module top level.
- Read server env only through `src/lib/server/env.ts`.
- Create Supabase admin clients only through `src/lib/server/supabaseAdmin.ts`.
- Keep `server-only` modules out of any `"use client"` file.
- When adding a new API route, follow the same lazy env + shared helper pattern.

## Build / runtime safety
- Prefer runtime `Missing ...` errors over build-time crashes when env is absent.
- Do not let the existence of an API route force env access during module load.
- Separate shared/browser utilities from server-only utilities.

## Validation
- Run `npx tsc --noEmit` after changes.
- Run `npm run build` after changes.

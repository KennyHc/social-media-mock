# RLS tests

- Local Supabase stack: `npx supabase start` then `npx supabase db reset` (applies `supabase/migrations` + `seed.sql`).
- No Docker images? Run a plain Postgres on 54322 and `tests/rls/reset-fallback.sh` (loads `stubs.sql`, then all migrations).
- Run: `npx vitest run tests/rls`. DB URL comes from `DATABASE_URL` (default `postgresql://postgres:postgres@127.0.0.1:54322/postgres`).
- Tests seed their own users/data via `db.ts` and delete them afterwards; files run serially against one database.

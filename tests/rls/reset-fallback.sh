#!/usr/bin/env bash
# Fallback for `npx supabase db reset` when the Supabase Docker stack is not
# available: drops and recreates a plain Postgres database, loads the
# Supabase stand-ins (tests/rls/stubs.sql), then applies every migration in
# order and the seed.
#
# Usage: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
#          tests/rls/reset-fallback.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
DB_NAME="${DB_URL##*/}"
DB_NAME="${DB_NAME%%\?*}"
ADMIN_URL="${DB_URL%/*}/template1"

psql_q() { psql -v ON_ERROR_STOP=1 -q "$@"; }

psql_q "$ADMIN_URL" -c "drop database if exists \"$DB_NAME\" with (force);"
psql_q "$ADMIN_URL" -c "create database \"$DB_NAME\";"

psql_q "$DB_URL" -f "$ROOT/tests/rls/stubs.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"
  psql_q "$DB_URL" --single-transaction -f "$f"
done
if [ -f "$ROOT/supabase/seed.sql" ]; then
  psql_q "$DB_URL" -f "$ROOT/supabase/seed.sql"
fi
echo "done"

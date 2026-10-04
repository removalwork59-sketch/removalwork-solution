#!/usr/bin/env bash
# Applies every SQL file in supabase/migrations (in order) to DATABASE_URL.
# Records applied files in public._deploy_migrations so re-running is safe.
set -euo pipefail; cd "$(dirname "$0")/.."
set -a; . ./.env.production; set +a
: "${DATABASE_URL:?DATABASE_URL missing in .env.production}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "create table if not exists public._deploy_migrations(name text primary key, applied_at timestamptz default now()); revoke all on public._deploy_migrations from anon, authenticated;"
for f in supabase/migrations/*.sql; do
  n=$(basename "$f")
  if [ "$(psql "$DATABASE_URL" -tAc "select 1 from public._deploy_migrations where name='$n'")" = "1" ]; then continue; fi
  echo "Applying $n"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -1 -f "$f"
  psql "$DATABASE_URL" -q -c "insert into public._deploy_migrations(name) values ('$n')"
done
echo "Migrations up to date."

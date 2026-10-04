#!/usr/bin/env bash
# Saves a compressed database backup to ./backups and keeps the newest 14.
set -euo pipefail; cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
: "${DATABASE_URL:?DATABASE_URL missing in .env}"
mkdir -p backups
f="backups/db-$(date +%Y%m%d-%H%M%S).sql.gz"
pg_dump "$DATABASE_URL" --no-owner --no-privileges --schema=public | gzip > "$f"
ls -1t backups/db-*.sql.gz | tail -n +15 | xargs -r rm --
echo "Backup saved: $f"

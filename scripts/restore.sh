#!/usr/bin/env bash
# Usage: ./scripts/restore.sh backups/db-YYYYMMDD-HHMMSS.sql.gz   (overwrites current data!)
set -euo pipefail; cd "$(dirname "$0")/.."
[ -f "${1:-}" ] || { echo "Usage: $0 <backup file>"; exit 1; }
set -a; . ./.env; set +a
read -r -p "This replaces the current database contents. Type YES to continue: " ok
[ "$ok" = "YES" ] || exit 1
gunzip -c "$1" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q
echo "Restore complete."

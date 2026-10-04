#!/usr/bin/env bash
# Update to the latest code: pull, back up, migrate, rebuild, restart, health check.
set -euo pipefail; cd "$(dirname "$0")/.."
git pull --ff-only
./scripts/backup.sh || echo "WARNING: backup skipped (check DATABASE_URL)"
./scripts/migrate.sh
docker compose --env-file .env.production up -d --build
sleep 8
./scripts/health.sh
docker image prune -f >/dev/null
echo "Deploy complete."

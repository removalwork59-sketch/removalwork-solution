#!/usr/bin/env bash
set -euo pipefail; cd "$(dirname "$0")/.."
docker compose --env-file .env.production up -d --build && echo "Started. Check: ./scripts/health.sh"

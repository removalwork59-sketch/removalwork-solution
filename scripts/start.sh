#!/usr/bin/env bash
set -euo pipefail; cd "$(dirname "$0")/.."
docker compose up -d --build && echo "Started. Check: ./scripts/health.sh"

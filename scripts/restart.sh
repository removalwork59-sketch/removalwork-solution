#!/usr/bin/env bash
set -euo pipefail; cd "$(dirname "$0")/.."; docker compose restart && ./scripts/health.sh

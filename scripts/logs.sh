#!/usr/bin/env bash
# Usage: ./scripts/logs.sh [lines]   (Ctrl+C to stop following)
cd "$(dirname "$0")/.."; docker compose logs -f --tail="${1:-200}" app

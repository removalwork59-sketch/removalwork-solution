#!/usr/bin/env bash
# Prints healthy / warning / unavailable for app, database, sign-in, Google API and AI.
URL="${1:-http://127.0.0.1:3000}"
curl -fsS "$URL/api/health" && echo || { echo "UNAVAILABLE — app is not responding at $URL"; exit 1; }

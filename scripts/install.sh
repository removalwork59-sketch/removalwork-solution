#!/usr/bin/env bash
# One-time server setup: Docker, Nginx, Certbot, PostgreSQL client. Run as root.
set -euo pipefail
apt-get update
apt-get install -y ca-certificates curl git nginx certbot python3-certbot-nginx postgresql-client
if ! command -v docker >/dev/null; then curl -fsSL https://get.docker.com | sh; fi
systemctl enable --now docker nginx
cd "$(dirname "$0")/.."
[ -f .env ] || { cp .env.example .env; echo "Created .env — edit it now: nano .env"; }
echo "Install complete."

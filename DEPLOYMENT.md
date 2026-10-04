# Deployment Guide — Google Review & Rating Scanner

Setup on one server:

```text
Internet → Nginx (ports 80/443, HTTPS) → App container (127.0.0.1:3000) → Hosted database + sign-in
```

You only need one container. The database and sign-in run on the hosted backend set by `SUPABASE_URL` and `DATABASE_URL`.

All commands below run on the VPS as `root`.

## 1. VPS requirements
- Ubuntu 22.04 or newer, 1 vCPU, 1 GB RAM (2 GB recommended), 10 GB disk
- Ports 22, 80 and 443 open
- A domain you control (`removalworksolution.online`)

## 2. Install Docker (plus Nginx, Certbot, PostgreSQL client)
```bash
apt-get update && apt-get install -y git
git clone <YOUR_GITHUB_REPO_URL> /opt/review-scanner
cd /opt/review-scanner
./scripts/install.sh
```

## 3. Clone repository
The step above cloned the code to `/opt/review-scanner`. Run every command after this from that folder.

## 4. Configure environment
```bash
nano .env.production      # created from .env.example by install.sh
```
Fill in `APP_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`, `DATABASE_URL` and `LOVABLE_API_KEY`.
You can leave `GOOGLE_MAPS_API_KEY` empty for now. The app keeps working and shows "Google API not configured".
Never commit `.env.production`. It is already in `.gitignore`.

## 5. Configure domain DNS
Add these records at your domain registrar:

| Type | Name | Value |
|------|------|-------|
| A | @ | your VPS IP |
| A | www | your VPS IP |

Check that it worked: `dig +short removalworksolution.online` should print your VPS IP.

## 6. Build containers
```bash
docker compose --env-file .env.production build
```

## 7. Start application
```bash
./scripts/start.sh
```

## 8. Run database migrations
```bash
./scripts/migrate.sh
```
This applies the SQL files in `drizzle/migrations` in order. You can run it again safely: files that were already applied are skipped.

## 9. Check health
```bash
./scripts/health.sh
```
Each check shows `healthy`, `warning` or `unavailable`. Until a Google key is added, `google_api: "warning"` is expected.

## 10. Configure Nginx
```bash
cp deploy/nginx.conf /etc/nginx/sites-available/removalworksolution.online
ln -sf /etc/nginx/sites-available/removalworksolution.online /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
```

## 11. Configure SSL
The first time, get the certificate before you enable the HTTPS block:
```bash
mkdir -p /var/www/certbot
systemctl stop nginx
certbot certonly --standalone -d removalworksolution.online -d www.removalworksolution.online
nginx -t && systemctl start nginx
```
Certificates renew automatically through the certbot timer. To test renewal: `certbot renew --dry-run`.

## 12. Verify application
- Open https://removalworksolution.online. You should see the login page.
- Sign in with the admin account.
- `curl https://removalworksolution.online/api/health`

## 13. View logs
```bash
./scripts/logs.sh        # follow live (Ctrl+C to exit)
./scripts/logs.sh 500    # last 500 lines
```

## 14. Restart application
```bash
./scripts/restart.sh
./scripts/status.sh
```

## 15. Update application
```bash
./scripts/deploy.sh      # pull → backup → migrate → rebuild → restart → health check
```

## 16. Backup database
```bash
./scripts/backup.sh
```
- Location: `/opt/review-scanner/backups/db-YYYYMMDD-HHMMSS.sql.gz`
- Retention: the newest 14 backups are kept automatically.
- Daily backup at 03:00: `crontab -e`, then add:
  `0 3 * * * cd /opt/review-scanner && ./scripts/backup.sh >> backups/backup.log 2>&1`
- Copy backups off the server regularly, for example with `scp` to your own computer.

## 17. Restore database
```bash
./scripts/restore.sh backups/db-YYYYMMDD-HHMMSS.sql.gz
```
This asks you to type `YES`, because it overwrites the current data.

## Command summary
| Command | What it does |
|---|---|
| `./scripts/install.sh` | One-time server setup |
| `./scripts/start.sh` | Build and start |
| `./scripts/stop.sh` | Stop |
| `./scripts/restart.sh` | Restart and run the health check |
| `./scripts/status.sh` | Show whether the container is running |
| `./scripts/logs.sh` | Show logs |
| `./scripts/migrate.sh` | Apply database changes |
| `./scripts/backup.sh` | Back up the database |
| `./scripts/restore.sh <file>` | Restore a backup |
| `./scripts/health.sh` | Run the health check |
| `./scripts/deploy.sh` | Update to the latest code |

## Security checklist
- Secrets live only in `.env.production`, which is never committed and never reaches browser code. Only the public URL and publishable key are built into the frontend.
- The app port listens only on `127.0.0.1`. Nginx is the only public entry point.
- Nginx forces HTTPS, adds HSTS and security headers, caps uploads at 2 MB, and rate-limits login (10/min) and the API (10 req/s).
- The app also enforces per-user rate limits, Zod input validation, CSV validation (a `google_url` column is required) and up to 500 URLs per batch.
- Row-level security on every table: each account sees only its own rows.
- Public sign-up is disabled. Passwords are stored only by the authentication service, never in app tables.

See `API.md` for every API endpoint.

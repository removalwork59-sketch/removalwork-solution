# API Reference

Base URL: `https://removalworksolution.online/api`

Every route except `/auth/login` and `/health` needs `Authorization: Bearer <access_token>`. You get the token from `/auth/login`.

Success response: `{ "ok": true, "data": ... }`
Error response: `{ "ok": false, "error": { "code": "...", "message": "..." } }`

| Method | Path | Notes |
|---|---|---|
| POST | /auth/login | `{ email, password }` → access_token, refresh_token |
| POST | /auth/logout | Ends the current session |
| GET | /auth/session | Current admin profile |
| POST | /scan | `{ url }`: runs the full pipeline and returns the report |
| GET | /scan/:id | Scan status and counts |
| POST | /scan/bulk | `{ urls: [...], batch_id? }` or a `text/csv` body with a `google_url` column. Up to 25 valid URLs per call, 2 at a time |
| GET | /scan/bulk/:id | Batch counts: total, pending, processing, completed, partial, failed |
| POST | /scan/bulk/:id/retry | Runs failed URLs again |
| GET | /scans?status=&limit= | Scan history |
| GET | /scans/:id | One scan |
| GET | /business/:id | Business details and its recent scans |
| GET | /reviews/:scanId | Original Google review data |
| GET | /reviews/:scanId/analysis | AI analysis, stored separately from the reviews |
| GET | /reports | Report list |
| GET | /reports/:id | Full report (`:id` = report id or scan id) |
| GET | /reports/:id/download | Download the report as a JSON file |
| GET | /settings | App configuration (no secrets) |
| GET | /settings/status | Status of the database, Google API, AI and sign-in |
| GET | /health | Public. `healthy` / `warning` / `unavailable` |

## Error codes
| Code | HTTP |
|---|---|
| UNAUTHORIZED | 401 |
| FORBIDDEN | 403 |
| RESOURCE_NOT_FOUND, BUSINESS_NOT_FOUND | 404 |
| SCAN_IN_PROGRESS | 409 |
| VALIDATION_ERROR, INVALID_GOOGLE_URL, NO_REVIEWS_AVAILABLE | 422 |
| RATE_LIMITED, GOOGLE_API_RATE_LIMIT | 429 |
| DATABASE_ERROR, REPORT_ERROR, INTERNAL_ERROR | 500 |
| GOOGLE_API_ERROR, ANALYSIS_ERROR | 502 |
| GOOGLE_API_NOT_CONFIGURED | 503 |

Reports are built only from stored scan, review and analysis data. Seed rows are labelled "Development data". A report never claims that Google removed a review; reporting to Google is an external action.

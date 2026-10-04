# Roadmap
- [x] Apply "standalone" brief: neutral branding, separate analysis/report tables, real 2-stage progress, health, audit
- [x] Admin account removalwork59@gmail.com, name defaults to "Admin"
- [x] Profile page (photo, name, username, email, password w/ confirm, status, last login, logout)
- [x] Canonical domain removalworksolution.online via config
- [ ] Google Places API key (waiting on user)
- [ ] Connect removalworksolution.online in project domain settings (user action, after publishing)

- [x] Phase 3: bulk URL scanning (paste/CSV, validation, batches, retry)
- [ ] Morning handoff: add Google key, run real single + small bulk scan (blocked: key)
- [x] REST API routes under /api (auth, scan, bulk, history, business, reviews, reports, settings, health)
- [x] VPS deployment: Dockerfile, compose, nginx, scripts/, DEPLOYMENT.md, API.md
- [x] Phase 4: deep audit — tracking (scan_events), Action Center, Quality Center, Error Center, System Quality + debug findings, AI verification/cache
- [ ] Phase 4 live checks: real Google scan, rating accuracy, cache reuse, report success rate (blocked: Google key)

- [x] Vala AI reply assistant (tones, editable draft, copy) in review panel
- [ ] Send Report to client by email — blocked: needs sender email domain setup (user decision)
- [x] Public homepage + admin editor (Settings → Homepage content)
- [x] Privacy Policy + Terms of Service pages (/privacy, /terms) with footer links editable in Settings
- [ ] Logo/favicon/social preview image from user upload — blocked: user has not uploaded an image yet (only text files)
- [x] Dashboard mobile: Recent scans table min-width + horizontal scroll
- [x] Mobile table scroll hint + keyboard accessibility (tabIndex, aria-label, focus ring)
- [x] Automated smoke test: scripts/smoke_pages.py — open + refresh all 12 pages, catches blank screens (12/12 PASS)
- [x] GitHub Actions smoke workflow: ADMIN_PASSWORD required secret (PR + deployment + live checks)
- [x] Post-deploy smoke: after main push, live URL tested automatically; failure fails the deployment check
- [ ] CI live checks will run once the GitHub repo is connected (user action: Plus menu → GitHub → Connect project)

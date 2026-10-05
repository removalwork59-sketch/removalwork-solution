<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Google data comes only from Places API (New) in `src/lib/google-places.server.ts` using `GOOGLE_PLACES_API_KEY`; never fake Google responses (product requirement).
- Review risk analysis runs server-side via Lovable AI Gateway in `src/lib/analysis.server.ts`; scans are orchestrated by `runScan` in `src/lib/scan.functions.ts`.
- Demo rows live in the DB with `is_seed=true` and must always render with a "demo seed" label; never present them as live data.
- Schema: businesses → scans → reviews (original Google data) → review_analyses (AI output, kept separate) → reports; audit_log records admin actions.
- Scans run in two server stages (`scanFetch`, `scanAnalyze`) so the UI progress reflects real state.
- Scan pipeline lives in `src/lib/scan-core.server.ts`; server functions and `/api/*` REST routes both call it so logic is never duplicated.
- REST routes (`src/routes/api/*`) use `src/lib/api.server.ts` (bearer auth via `guarded`, uniform `{ok,error:{code}}` errors); load it with dynamic import inside handlers.
- VPS builds use `NITRO_PRESET=node-server` (Dockerfile); secrets live in untracked `.env.production`, never the repo `.env`.
- Scan lifecycle is recorded in `scan_events`, failures in `error_events`, audit findings in `debug_findings` (written only by migrations); ops UI lives in `src/components/ops-panels.tsx` backed by `src/lib/ops.functions.ts` and is placed inside existing pages (no new sidebar items).
- AI analysis: primary model + second-model verification for high/medium flags (never upgrades risk), evidence guard, and SHA-256 content-hash cache keyed by prompt + app version.
- Canonical app URL comes from `VITE_PUBLIC_APP_URL` via `src/lib/config.ts`, so the domain can change without code edits.
- Public sign-up is disabled (single admin); profile data lives in `profiles`, avatars in the private `avatars` bucket via signed URLs.
- Bulk scans: `scan_batches` groups scans via `scans.batch_id`; the browser runs per-URL stages with concurrency 2 (no queue infra) to avoid flooding Google.
- Google key is read from `GOOGLE_MAPS_API_KEY`, `GOOGLE_PLACES_API_KEY` or `GOOGLE_API_KEY`.
- Public homepage content lives in `site_content` (draft + published JSON) merged over `DEFAULT_CONTENT` in `src/lib/site-content.ts`; edited in Settings, so the homepage never depends on the scanner.

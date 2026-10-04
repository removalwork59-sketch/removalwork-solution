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
- Canonical app URL comes from `VITE_PUBLIC_APP_URL` via `src/lib/config.ts`, so the domain can change without code edits.
- Public sign-up is disabled (single admin); profile data lives in `profiles`, avatars in the private `avatars` bucket via signed URLs.

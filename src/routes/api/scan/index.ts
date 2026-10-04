import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// POST /api/scan — full real pipeline: validate → fetch from Google → store → analyze → report.
export const Route = createFileRoute("/api/scan/")({
  server: { handlers: { POST: async ({ request }) => {
    const a = await import("@/lib/api.server");
    return a.guarded(request, async ({ supabase, userId }) => {
      const p = z.object({ url: z.string().trim().min(5).max(2000) }).safeParse(await a.readJson(request));
      if (!p.success) return a.err("VALIDATION_ERROR", "Send JSON { \"url\": \"<Google Maps link>\" }.");
      if (a.rateLimited(`scan:${userId}`, 10, 60_000)) return a.err("RATE_LIMITED", "Too many scans in a minute. Please wait.");
      const core = await import("@/lib/scan-core.server");
      const f = await core.scanFetchCore(supabase, userId, { url: p.data.url });
      if (!f.ok) return a.err(f.code, f.message, { scan_id: f.scanId ?? null });
      const r = await core.scanAnalyzeCore(supabase, userId, { scanId: f.scanId });
      if (!r.ok) return a.err(r.code, r.message, { scan_id: f.scanId });
      return a.ok(await a.buildReport(supabase, f.scanId), 201);
    });
  } } },
});

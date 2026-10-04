import { createFileRoute } from "@tanstack/react-router";

// POST /api/scan/bulk/:id/retry — re-runs every failed URL in the batch (max 25 per call).
export const Route = createFileRoute("/api/scan/bulk/$id/retry")({
  server: { handlers: { POST: async ({ request, params }) => {
    const a = await import("@/lib/api.server");
    return a.guarded(request, async ({ supabase, userId }) => {
      if (!a.isUuid(params.id)) return a.err("VALIDATION_ERROR", "Invalid batch id.");
      const core = await import("@/lib/scan-core.server");
      const { data: batch } = await supabase.from("scan_batches").select("id").eq("id", params.id).maybeSingle();
      if (!batch) return a.err("RESOURCE_NOT_FOUND", "Batch not found.");
      const { data: scans } = await supabase.from("scans").select("id, source_url, status").eq("batch_id", params.id).order("created_at", { ascending: false });
      const latest = new Map<string, string>();
      for (const s of scans ?? []) if (!latest.has(s.source_url)) latest.set(s.source_url, s.status);
      const failed = [...latest].filter(([, st]) => st === "failed").map(([u]) => u).slice(0, 25);
      const results: { url: string; status: string; scan_id?: string | undefined; code?: string; message?: string }[] = [];
      for (const url of failed) {
        const f = await core.scanFetchCore(supabase, userId, { url, batchId: batch.id });
        if (!f.ok) { results.push({ url, status: "failed", scan_id: f.scanId, code: a.apiCode(f.code), message: f.message }); continue; }
        const r = await core.scanAnalyzeCore(supabase, userId, { scanId: f.scanId });
        results.push(r.ok ? { url, status: "completed", scan_id: f.scanId } : { url, status: "partial", scan_id: f.scanId, code: a.apiCode(r.code), message: r.message });
      }
      return a.ok({ batch_id: batch.id, retried: failed.length, results });
    });
  } } },
});

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// POST /api/scan/bulk — JSON { urls: string[], batch_id? } or text/csv body with a google_url column.
// Runs up to 25 URLs per call with concurrency 2; pass batch_id to append more URLs to the same batch.
export const Route = createFileRoute("/api/scan/bulk/")({
  server: { handlers: { POST: async ({ request }) => {
    const a = await import("@/lib/api.server");
    return a.guarded(request, async ({ supabase, userId }) => {
      const core = await import("@/lib/scan-core.server");
      let urls: string[] = [], batchId: string | undefined;
      const ct = request.headers.get("content-type") ?? "";
      if (Number(request.headers.get("content-length") ?? 0) > 1_000_000) return a.err("VALIDATION_ERROR", "Upload is larger than 1 MB.");
      if (ct.includes("text/csv")) {
        try { urls = a.parseCsvUrls(await request.text()); } catch (e) { return a.err("VALIDATION_ERROR", (e as Error).message); }
        batchId = new URL(request.url).searchParams.get("batch_id") ?? undefined;
      } else {
        const p = z.object({ urls: z.array(z.string().max(2000)).min(1).max(500), batch_id: z.string().uuid().optional() }).safeParse(await a.readJson(request));
        if (!p.success) return a.err("VALIDATION_ERROR", "Send JSON { \"urls\": [\"<Google Maps link>\", ...] } or a CSV with a google_url column.");
        urls = p.data.urls; batchId = p.data.batch_id;
      }
      const v = a.normalizeUrls(urls, core.validGoogleUrl);
      if (!v.valid.length) return a.err("INVALID_GOOGLE_URL", "No valid Google Maps links found.", { validation: v });
      if (v.valid.length > 25) return a.err("VALIDATION_ERROR", "Send at most 25 valid URLs per call. Use batch_id to add more to the same batch.", { validation: { valid: v.valid.length, invalid: v.invalid, duplicate: v.duplicate } });
      let batch;
      if (batchId) {
        const { data } = await supabase.from("scan_batches").select("id, batch_number, total").eq("id", batchId).maybeSingle();
        if (!data) return a.err("NOT_FOUND", "Batch not found.");
        await supabase.from("scan_batches").update({ total: data.total + v.valid.length }).eq("id", data.id);
        batch = data;
      } else {
        const { data, error } = await supabase.from("scan_batches").insert({ user_id: userId, total: v.valid.length }).select("id, batch_number, total").single();
        if (error || !data) return a.err("DATABASE_ERROR", "Batch could not be created.");
        batch = data;
        await core.audit(supabase, userId, "batch.started", { batch_id: data.id, total: v.valid.length, via: "api" });
      }
      const results: { url: string; status: string; scan_id?: string; code?: string; message?: string }[] = [];
      const queue = [...v.valid];
      const worker = async () => {
        for (let url = queue.shift(); url; url = queue.shift()) {
          const f = await core.scanFetchCore(supabase, userId, { url, batchId: batch.id });
          if (!f.ok) { results.push({ url, status: "failed", scan_id: f.scanId, code: a.apiCode(f.code), message: f.message }); continue; }
          const r = await core.scanAnalyzeCore(supabase, userId, { scanId: f.scanId });
          results.push(r.ok ? { url, status: "completed", scan_id: f.scanId } : { url, status: "partial", scan_id: f.scanId, code: a.apiCode(r.code), message: r.message });
        }
      };
      await Promise.all([worker(), worker()]);
      return a.ok({ batch_id: batch.id, batch_number: batch.batch_number, validation: v, results }, 201);
    });
  } } },
});

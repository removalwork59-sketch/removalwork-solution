import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/scan/bulk/$id")({
  server: { handlers: { GET: async ({ request, params }) => {
    const a = await import("@/lib/api.server");
    return a.guarded(request, async ({ supabase }) => {
      if (!a.isUuid(params.id)) return a.err("VALIDATION_ERROR", "Invalid batch id.");
      const { data: batch } = await supabase.from("scan_batches").select("*").eq("id", params.id).maybeSingle();
      if (!batch) return a.err("RESOURCE_NOT_FOUND", "Batch not found.");
      const { data: scans } = await supabase.from("scans").select("id, source_url, business_name, status, stage, rating, reviews_retrieved, high_count, medium_count, error, created_at").eq("batch_id", params.id).order("created_at");
      const list = scans ?? [];
      const cnt = (f: (s: (typeof list)[number]) => boolean) => list.filter(f).length;
      const completed = cnt((s) => s.status === "complete");
      const processing = cnt((s) => s.status === "running");
      const partial = cnt((s) => s.status === "failed" && s.reviews_retrieved > 0);
      const failed = cnt((s) => s.status === "failed") - partial;
      return a.ok({ ...batch, counts: { total: batch.total, completed, processing, partial, failed, pending: Math.max(batch.total - list.length, 0) }, scans: list });
    });
  } } },
});

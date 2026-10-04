import { createFileRoute } from "@tanstack/react-router";

// GET /api/reports/:id — :id may be a report id or a scan id.
export const Route = createFileRoute("/api/reports/$id")({
  server: { handlers: { GET: async ({ request, params }) => {
    const a = await import("@/lib/api.server");
    return a.guarded(request, async ({ supabase }) => {
      if (!a.isUuid(params.id)) return a.err("VALIDATION_ERROR", "Invalid id.");
      const { data: rep } = await supabase.from("reports").select("scan_id").eq("id", params.id).maybeSingle();
      try {
        const r = await a.buildReport(supabase, rep?.scan_id ?? params.id);
        return r ? a.ok(r) : a.err("NOT_FOUND", "Report not found.");
      } catch { return a.err("REPORT_ERROR", "The report could not be built."); }
    });
  } } },
});

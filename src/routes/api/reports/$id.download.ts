import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/reports/$id/download")({
  server: { handlers: { GET: async ({ request, params }) => {
    const a = await import("@/lib/api.server");
    return a.guarded(request, async ({ supabase, userId }) => {
      if (!a.isUuid(params.id)) return a.err("VALIDATION_ERROR", "Invalid id.");
      const { data: rep } = await supabase.from("reports").select("scan_id").eq("id", params.id).maybeSingle();
      const scanId = rep?.scan_id ?? params.id;
      let r;
      try { r = await a.buildReport(supabase, scanId); } catch { return a.err("REPORT_ERROR", "The report could not be built."); }
      if (!r) return a.err("RESOURCE_NOT_FOUND", "Report not found.");
      await supabase.from("audit_log").insert({ user_id: userId, action: "report.downloaded", detail: { scan_id: scanId, via: "api" } });
      const name = (r.report_number ?? "report-" + scanId.slice(0, 8)) + ".json";
      return new Response(JSON.stringify(r, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
    });
  } } },
});

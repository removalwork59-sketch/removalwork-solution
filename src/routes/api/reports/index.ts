import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/reports/")({
  server: { handlers: { GET: async ({ request }) => {
    const a = await import("@/lib/api.server");
    return a.guarded(request, async ({ supabase }) => {
      const { data, error } = await supabase.from("reports").select("id, scan_id, report_number, status, summary, high_risk_count, medium_risk_count, normal_count, is_seed, created_at").order("created_at", { ascending: false }).limit(200);
      if (error) return a.err("DATABASE_ERROR", "Database unavailable.");
      return a.ok(data);
    });
  } } },
});

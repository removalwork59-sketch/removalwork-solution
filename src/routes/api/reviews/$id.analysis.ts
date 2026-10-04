import { createFileRoute } from "@tanstack/react-router";

// GET /api/reviews/:id/analysis — AI analysis rows for a scan (kept separate from original review data).
export const Route = createFileRoute("/api/reviews/$id/analysis")({
  server: { handlers: { GET: async ({ request, params }) => {
    const a = await import("@/lib/api.server");
    return a.guarded(request, async ({ supabase }) => {
      if (!a.isUuid(params.id)) return a.err("VALIDATION_ERROR", "Invalid scan id.");
      const { data, error } = await supabase.from("review_analyses").select("*").eq("scan_id", params.id);
      if (error) return a.err("DATABASE_ERROR", "Database unavailable.");
      return a.ok(data);
    });
  } } },
});

import { createFileRoute } from "@tanstack/react-router";

// GET /api/reviews/:id — :id is a scan id; returns the original Google review rows for it.
export const Route = createFileRoute("/api/reviews/$id")({
  server: { handlers: { GET: async ({ request, params }) => {
    const a = await import("@/lib/api.server");
    return a.guarded(request, async ({ supabase }) => {
      if (!a.isUuid(params.id)) return a.err("VALIDATION_ERROR", "Invalid scan id.");
      const { data, error } = await supabase.from("reviews").select("id, author, author_uri, rating, published_at, relative_time, text, review_uri, created_at").eq("scan_id", params.id).order("created_at");
      if (error) return a.err("DATABASE_ERROR", "Database unavailable.");
      return a.ok(data);
    });
  } } },
});

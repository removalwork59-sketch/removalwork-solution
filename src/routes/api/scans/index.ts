import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/scans/")({
  server: { handlers: { GET: async ({ request }) => {
    const a = await import("@/lib/api.server");
    return a.guarded(request, async ({ supabase }) => {
      const u = new URL(request.url);
      const limit = Math.min(Math.max(Number(u.searchParams.get("limit") ?? 50) || 50, 1), 200);
      let q = supabase.from("scans").select("id, business_name, source_url, status, rating, total_reviews, reviews_retrieved, high_count, medium_count, normal_count, requires_review_count, is_seed, batch_id, created_at, completed_at, error").order("created_at", { ascending: false }).limit(limit);
      const status = u.searchParams.get("status");
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return a.err("DATABASE_ERROR", "Database unavailable.");
      return a.ok(data);
    });
  } } },
});

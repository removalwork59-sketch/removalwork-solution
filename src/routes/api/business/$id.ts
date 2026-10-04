import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/business/$id")({
  server: { handlers: { GET: async ({ request, params }) => {
    const a = await import("@/lib/api.server");
    return a.guarded(request, async ({ supabase }) => {
      if (!a.isUuid(params.id)) return a.err("VALIDATION_ERROR", "Invalid business id.");
      const { data, error } = await supabase.from("businesses").select("*").eq("id", params.id).maybeSingle();
      if (error) return a.err("DATABASE_ERROR", "Database unavailable.");
      if (!data) return a.err("BUSINESS_NOT_FOUND", "Business not found.");
      const { data: scans } = await supabase.from("scans").select("id, status, created_at, high_count, medium_count").eq("business_id", params.id).order("created_at", { ascending: false }).limit(20);
      return a.ok({ ...data, scans: scans ?? [] });
    });
  } } },
});

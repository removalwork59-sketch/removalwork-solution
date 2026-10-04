import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/scans/$id")({
  server: { handlers: { GET: async ({ request, params }) => {
    const a = await import("@/lib/api.server");
    return a.guarded(request, async ({ supabase }) => {
      if (!a.isUuid(params.id)) return a.err("VALIDATION_ERROR", "Invalid scan id.");
      const { data, error } = await supabase.from("scans").select("*").eq("id", params.id).maybeSingle();
      if (error) return a.err("DATABASE_ERROR", "Database unavailable.");
      if (!data) return a.err("NOT_FOUND", "Scan not found.");
      return a.ok({ ...data, data_label: data.is_seed ? "Development data" : "Live Google Places data" });
    });
  } } },
});

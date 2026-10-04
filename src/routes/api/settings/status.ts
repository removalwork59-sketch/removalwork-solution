import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/settings/status")({
  server: { handlers: { GET: async ({ request }) => {
    const a = await import("@/lib/api.server");
    return a.guarded(request, async ({ supabase }) => {
      const t0 = Date.now();
      const db = await supabase.from("scans").select("id", { head: true, count: "exact" });
      const svc = await import("@/lib/google-places-service.server");
      const google = svc.GooglePlacesService.isConfigured();
      return a.ok({
        database: db.error ? "unavailable" : "healthy", database_ms: Date.now() - t0,
        google_api: google ? "healthy" : "GOOGLE_API_NOT_CONFIGURED",
        ai: process.env["LOVABLE_API_KEY"] ? "healthy" : "unavailable",
        authentication: "healthy",
      });
    });
  } } },
});

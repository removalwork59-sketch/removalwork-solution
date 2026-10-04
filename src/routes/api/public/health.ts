import { createFileRoute } from "@tanstack/react-router";

// Public liveness probe for uptime monitors / `curl`. Returns no data or secrets.
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        let database: "healthy" | "unavailable" = "unavailable";
        try {
          if (url && key) {
            const r = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
            database = r.ok ? "healthy" : "unavailable";
          }
        } catch { /* unavailable */ }
        const body = {
          application: "healthy",
          backend: database,
          google_api: process.env["GOOGLE_PLACES_API_KEY"] ? "configured" : "configuration_required",
          ai: process.env["LOVABLE_API_KEY"] ? "configured" : "unavailable",
          time: new Date().toISOString(),
        };
        return Response.json(body, { status: database === "healthy" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});

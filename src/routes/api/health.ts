import { createFileRoute } from "@tanstack/react-router";

type S = "healthy" | "warning" | "unavailable";

// GET /api/health — public, no data or secrets. 200 when healthy/warning, 503 when unavailable.
export const Route = createFileRoute("/api/health")({
  server: { handlers: { GET: async () => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    let database: S = "unavailable", authentication: S = "unavailable";
    try {
      if (url && key) {
        const [r, d] = await Promise.all([
          fetch(`${url}/auth/v1/health`, { headers: { apikey: key } }),
          fetch(`${url}/rest/v1/`, { headers: { apikey: key } }),
        ]);
        authentication = r.ok ? "healthy" : "unavailable";
        database = d.status < 500 ? "healthy" : "unavailable";
      }
    } catch { /* unavailable */ }
    const google: S = (process.env["GOOGLE_MAPS_API_KEY"] || process.env["GOOGLE_PLACES_API_KEY"]) ? "healthy" : "warning";
    const ai: S = process.env["LOVABLE_API_KEY"] ? "healthy" : "warning";
    const checks = { application: "healthy" as S, database, authentication, google_api: google, ai };
    const vals = Object.values(checks);
    const status: S = vals.includes("unavailable") ? "unavailable" : vals.includes("warning") ? "warning" : "healthy";
    return Response.json({ status, checks, google_api_detail: google === "warning" ? "GOOGLE_API_NOT_CONFIGURED" : "configured", time: new Date().toISOString() },
      { status: status === "unavailable" ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } } },
});

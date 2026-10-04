import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/settings/")({
  server: { handlers: { GET: async ({ request }) => {
    const a = await import("@/lib/api.server");
    return a.guarded(request, async () => {
      const { APP_VERSION } = await import("@/lib/version");
      return a.ok({
        app_url: process.env["APP_URL"] || process.env["VITE_PUBLIC_APP_URL"] || "https://removalworksolution.online",
        version: APP_VERSION, data_source: "Google Places API (New)", review_limit_per_place: 5,
        bulk: { max_urls_per_batch: 500, max_urls_per_api_call: 25, concurrency: 2 },
        signup: "disabled",
      });
    });
  } } },
});

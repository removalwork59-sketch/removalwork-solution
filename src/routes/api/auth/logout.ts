import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/logout")({
  server: { handlers: { POST: async ({ request }) => {
    const a = await import("@/lib/api.server");
    return a.guarded(request, async ({ supabase, userId, token }) => {
      await supabase.from("audit_log").insert({ user_id: userId, action: "auth.logout", detail: { via: "api" } });
      await fetch(`${process.env["SUPABASE_URL"]}/auth/v1/logout?scope=local`, { method: "POST", headers: { apikey: process.env["SUPABASE_PUBLISHABLE_KEY"]!, Authorization: `Bearer ${token}` } });
      return a.ok({ signed_out: true });
    });
  } } },
});

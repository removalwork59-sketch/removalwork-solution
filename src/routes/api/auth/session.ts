import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/session")({
  server: { handlers: { GET: async ({ request }) => {
    const a = await import("@/lib/api.server");
    return a.guarded(request, async ({ supabase, userId, email }) => {
      const { data: profile } = await supabase.from("profiles").select("name, username, status").eq("user_id", userId).maybeSingle();
      return a.ok({ authenticated: true, user: { id: userId, email, name: profile?.name ?? "Admin", username: profile?.username ?? email, status: profile?.status ?? "active" } });
    });
  } } },
});

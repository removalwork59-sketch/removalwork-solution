import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/api/auth/login")({
  server: { handlers: { POST: async ({ request }) => {
    const a = await import("@/lib/api.server");
    const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "local";
    if (a.rateLimited(`login:${ip}`, 10, 60_000)) return a.err("RATE_LIMITED", "Too many sign-in attempts. Wait a minute and try again.");
    const p = z.object({ email: z.string().trim().email().max(255), password: z.string().min(1).max(200) }).safeParse(await a.readJson(request));
    if (!p.success) return a.err("VALIDATION_ERROR", "Enter a valid email and password.");
    const { data, error } = await a.publicClient().auth.signInWithPassword(p.data);
    if (error || !data.session) return a.err("UNAUTHORIZED", "Invalid username or password.");
    const s = data.session;
    await a.publicClient(s.access_token).from("audit_log").insert({ user_id: s.user.id, action: "auth.login", detail: { via: "api" } });
    return a.ok({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at, user: { id: s.user.id, email: s.user.email } });
  } } },
});

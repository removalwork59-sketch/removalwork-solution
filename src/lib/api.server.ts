// Shared helpers for the /api REST routes: bearer auth, consistent errors, rate limiting.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Db = SupabaseClient<Database>;

const STATUS: Record<string, number> = {
  UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, BUSINESS_NOT_FOUND: 404,
  VALIDATION_ERROR: 422, INVALID_GOOGLE_URL: 422, NO_REVIEWS_AVAILABLE: 422,
  GOOGLE_API_RATE_LIMIT: 429, RATE_LIMITED: 429, SCAN_IN_PROGRESS: 409,
  GOOGLE_API_NOT_CONFIGURED: 503, GOOGLE_API_ERROR: 502, ANALYSIS_ERROR: 502,
  DATABASE_ERROR: 500, REPORT_ERROR: 500, INTERNAL_ERROR: 500,
};

// Map internal pipeline codes to the public API error vocabulary.
const MAP: Record<string, string> = {
  INVALID_URL: "INVALID_GOOGLE_URL", NOT_FOUND: "BUSINESS_NOT_FOUND", NO_REVIEWS: "NO_REVIEWS_AVAILABLE",
  INSUFFICIENT_DATA: "NO_REVIEWS_AVAILABLE", RATE_LIMIT: "GOOGLE_API_RATE_LIMIT", API_UNAVAILABLE: "GOOGLE_API_ERROR",
  GOOGLE_ERROR: "GOOGLE_API_ERROR", NETWORK: "GOOGLE_API_ERROR", DB_UNAVAILABLE: "DATABASE_ERROR",
  AI_UNAVAILABLE: "ANALYSIS_ERROR", UNKNOWN: "INTERNAL_ERROR",
};

export const apiCode = (c: string) => MAP[c] ?? c;

const noStore = { "Cache-Control": "no-store" };

export function ok(data: unknown, status = 200) {
  return Response.json({ ok: true, data }, { status, headers: noStore });
}

export function err(code: string, message: string, extra?: Record<string, unknown>) {
  const c = apiCode(code);
  return Response.json({ ok: false, error: { code: c, message, ...extra } }, { status: STATUS[c] ?? 500, headers: noStore });
}

function sbFetch(key: string): typeof fetch {
  return (input, init) => {
    const h = new Headers(init?.headers);
    if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
    h.set("apikey", key);
    return fetch(input, { ...init, headers: h });
  };
}

export function publicClient(token?: string): Db {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: { fetch: sbFetch(key), headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
}

export function bearer(request: Request): string | null {
  const h = request.headers.get("authorization");
  return h?.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : null;
}

/** Authenticate the caller; returns a user-scoped client (RLS applies) or an error Response. */
export async function auth(request: Request): Promise<{ supabase: Db; userId: string; email: string | null; token: string } | Response> {
  const token = bearer(request);
  if (!token) return err("UNAUTHORIZED", "Sign in required. Send Authorization: Bearer <access_token>.");
  const supabase = publicClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return err("UNAUTHORIZED", "Session is invalid or expired. Sign in again.");
  return { supabase, userId: data.user.id, email: data.user.email ?? null, token };
}

// Best-effort per-worker rate limit (cheap guard; not a global quota).
const hits = new Map<string, number[]>();
export function rateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > limit;
}

export async function readJson(request: Request): Promise<unknown> {
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > 2_000_000) throw new Error("TOO_LARGE");
  try { return await request.json(); } catch { return null; }
}

export const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/** Validate + dedupe a URL list (used by bulk scan). */
export function normalizeUrls(urls: string[], valid: (u: string) => boolean) {
  const seen = new Set<string>();
  const out = { valid: [] as string[], invalid: [] as string[], duplicate: [] as string[] };
  for (const raw of urls.map((u) => u.trim()).filter(Boolean)) {
    if (!valid(raw)) { out.invalid.push(raw); continue; }
    const key = raw.replace(/\/+$/, "").toLowerCase();
    if (seen.has(key)) { out.duplicate.push(raw); continue; }
    seen.add(key); out.valid.push(raw);
  }
  return out;
}

export function parseCsvUrls(csv: string): string[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const head = lines[0]!.split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const idx = head.indexOf("google_url");
  if (idx === -1) throw new Error("CSV must have a google_url column.");
  return lines.slice(1).map((l) => (l.split(",")[idx] ?? "").trim().replace(/^"|"$/g, ""));
}

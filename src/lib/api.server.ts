// Shared helpers for the /api REST routes: bearer auth, consistent errors, rate limiting.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Db = SupabaseClient<Database>;

const STATUS: Record<string, number> = {
  UNAUTHORIZED: 401, FORBIDDEN: 403, RESOURCE_NOT_FOUND: 404, BUSINESS_NOT_FOUND: 404,
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

type Ctx = { supabase: Db; userId: string; email: string | null; token: string };
/** Run an authenticated handler with uniform error handling. */
export async function guarded(request: Request, fn: (ctx: Ctx) => Promise<Response>): Promise<Response> {
  try {
    const a = await auth(request);
    if (a instanceof Response) return a;
    if (rateLimited(`u:${a.userId}`, 120, 60_000)) return err("RATE_LIMITED", "Too many requests. Slow down and try again in a minute.");
    return await fn(a);
  } catch (e) {
    console.error("api error", e);
    return err("INTERNAL_ERROR", "Something went wrong on the server.");
  }
}

/** Full report payload built from stored scan, review and analysis rows. */
export async function buildReport(supabase: Db, scanId: string) {
  const { data: scan, error } = await supabase.from("scans").select("*").eq("id", scanId).maybeSingle();
  if (error) throw new Error("DATABASE_ERROR");
  if (!scan) return null;
  const [{ data: reviews }, { data: analyses }, { data: report }] = await Promise.all([
    supabase.from("reviews").select("*").eq("scan_id", scanId).order("created_at"),
    supabase.from("review_analyses").select("*").eq("scan_id", scanId),
    supabase.from("reports").select("*").eq("scan_id", scanId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const byReview = new Map((analyses ?? []).map((a) => [a.review_id, a]));
  const items = (reviews ?? []).map((r) => {
    const a = byReview.get(r.id);
    return {
      id: r.id, author: r.author, rating: r.rating, published_at: r.published_at, text: r.text, google_review_link: r.review_uri,
      risk: a?.risk ?? r.risk, category: a?.category ?? r.policy_category, reason: a?.reason ?? r.reason,
      evidence: a?.evidence ?? r.evidence, confidence: a?.confidence ?? r.confidence, signals: a?.signals ?? r.indicators,
    };
  });
  const flagged = items.filter((i) => i.risk === "high" || i.risk === "medium");
  return {
    data_label: scan.is_seed ? "Development data — not live Google data" : "Live Google Places data",
    report_number: report?.report_number ?? null,
    generated_at: report?.created_at ?? null,
    status: scan.status,
    business: { name: scan.business_name, category: scan.category, address: scan.address, google_maps_link: scan.maps_uri },
    rating: scan.rating, review_count: scan.total_reviews,
    reviews_retrieved: scan.reviews_retrieved, reviews_analyzed: analyses?.length ?? 0,
    risk_summary: { high: scan.high_count, medium: scan.medium_count, normal: scan.normal_count, requires_review: scan.requires_review_count },
    summary: report?.summary ?? null, recommended_action: report?.recommended_action ?? null,
    flagged_reviews: flagged, reviews: items,
    official_google_reporting: {
      help: "https://support.google.com/business/answer/4596773",
      note: "External action. This report has not been submitted to Google and does not mean Google removed any review.",
    },
    note: "Google returns a limited number of available reviews per business (up to 5).",
  };
}

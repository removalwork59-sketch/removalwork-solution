import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ScanError, resolveAndFetchPlace } from "./google-places.server";
import { analyzeReviews, ANALYSIS_MODEL, AI_PROVIDER } from "./analysis.server";

export const APP_VERSION = "1.1.0";

type Health = "healthy" | "warning" | "unavailable";

export const getSystemStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const t0 = Date.now();
    const db = await context.supabase.from("scans").select("id", { head: true, count: "exact" });
    const dbMs = Date.now() - t0;
    const tables = await Promise.all(["businesses", "review_analyses", "reports", "audit_log"].map((t) =>
      context.supabase.from(t as "reports").select("id", { head: true, count: "exact" })));
    const migrationsOk = tables.every((r) => !r.error);
    const googleConfigured = Boolean(process.env["GOOGLE_PLACES_API_KEY"]);
    const aiConfigured = Boolean(process.env["LOVABLE_API_KEY"]);
    const checks: { name: string; status: Health; detail: string }[] = [
      { name: "Application", status: "healthy", detail: `Version ${APP_VERSION} responding` },
      { name: "Database", status: db.error ? "unavailable" : "healthy", detail: db.error ? db.error.message : `Responded in ${dbMs} ms` },
      { name: "Google API", status: googleConfigured ? "healthy" : "warning", detail: googleConfigured ? "Places API (New) key configured" : "Configuration required — GOOGLE_PLACES_API_KEY not set" },
      { name: "AI service", status: aiConfigured ? "healthy" : "unavailable", detail: aiConfigured ? `${AI_PROVIDER} · ${ANALYSIS_MODEL}` : "AI key missing" },
      { name: "Storage", status: "healthy", detail: "Not required — reports are generated on demand" },
      { name: "Authentication", status: context.userId ? "healthy" : "unavailable", detail: "Admin session verified" },
    ];
    return {
      googleConfigured, aiConfigured, aiProvider: AI_PROVIDER, aiModel: ANALYSIS_MODEL,
      databaseOk: !db.error, migrationsOk, reviewLimit: 5, version: APP_VERSION,
      environment: process.env["NODE_ENV"] === "production" ? "production" : "development",
      checks, checkedAt: new Date().toISOString(),
    };
  });

export type StageResponse = { ok: true; scanId: string; reviews: number } | { ok: false; code: string; message: string; scanId?: string };

async function audit(supabase: any, userId: string, action: string, detail: Record<string, unknown>) {
  await supabase.from("audit_log").insert({ user_id: userId, action, detail });
}

function validGoogleUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    return /(^|\.)google\.[a-z.]+$/.test(u.hostname) || /^(maps\.app\.goo\.gl|goo\.gl|g\.page|g\.co)$/.test(u.hostname);
  } catch { return false; }
}

/** Stage 1: resolve business, read public place data, retrieve available reviews. */
export const scanFetch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().trim().min(5).max(2000) }).parse(d))
  .handler(async ({ data, context }): Promise<StageResponse> => {
    const { supabase, userId } = context;
    if (!validGoogleUrl(data.url)) return { ok: false, code: "INVALID_URL", message: "This isn't a Google Maps or Business link. Paste a link like google.com/maps/place/… or maps.app.goo.gl/…" };
    const googleKey = process.env["GOOGLE_PLACES_API_KEY"];
    if (!googleKey) return { ok: false, code: "API_KEY_REQUIRED", message: "Google Places API is not configured. Add the API key in Settings." };

    const since = new Date(Date.now() - 2 * 60_000).toISOString();
    const { data: dup } = await supabase.from("scans").select("id").eq("user_id", userId).eq("source_url", data.url).eq("status", "running").gte("created_at", since).limit(1);
    if (dup?.length) return { ok: false, code: "SCAN_IN_PROGRESS", message: "A scan for this link is already running. Please wait for it to finish.", scanId: dup[0]!.id };
    const { data: scan, error } = await supabase.from("scans")
      .insert({ user_id: userId, source_url: data.url, status: "running", stage: "fetch", data_source: "google_places" })
      .select("id").single();
    if (error || !scan) return { ok: false, code: "DB_UNAVAILABLE", message: "Database unavailable — the scan could not be saved." };
    await audit(supabase, userId, "scan.started", { scan_id: scan.id, url: data.url });

    try {
      const place = await resolveAndFetchPlace(googleKey, data.url);
      const biz = await supabase.from("businesses").upsert({
        user_id: userId, place_id: place.placeId, name: place.name, category: place.category, address: place.address,
        rating: place.rating, total_reviews: place.totalReviews, maps_uri: place.mapsUri, latitude: place.latitude, longitude: place.longitude, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,place_id" }).select("id").single();
      if (biz.error) throw new ScanError("DB_UNAVAILABLE", "Database unavailable — business could not be saved.");

      if (place.reviews.length) {
        const ins = await supabase.from("reviews").insert(place.reviews.map((r) => ({
          scan_id: scan.id, author: r.author, author_uri: r.authorUri, rating: r.rating, published_at: r.publishedAt,
          relative_time: r.relativeTime, text: r.text, review_uri: r.reviewUri,
        })));
        if (ins.error) throw new ScanError("DB_UNAVAILABLE", "Database unavailable — reviews could not be saved.");
      }
      await supabase.from("scans").update({
        business_id: biz.data.id, place_id: place.placeId, business_name: place.name, category: place.category, address: place.address,
        rating: place.rating, total_reviews: place.totalReviews, maps_uri: place.mapsUri, reviews_retrieved: place.reviews.length,
        stage: "analyze", ...(place.reviews.length === 0 ? { status: "failed", error: "No available reviews were returned for this business." } : {}),
      }).eq("id", scan.id);
      if (place.reviews.length === 0) return { ok: false, code: "NO_REVIEWS", message: "No available reviews were returned for this business.", scanId: scan.id };
      return { ok: true, scanId: scan.id, reviews: place.reviews.length };
    } catch (e) {
      return fail(supabase, userId, scan.id, e);
    }
  });

/** Stage 2: analyze review signals, classify risk, prepare report. */
export const scanAnalyze = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ scanId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<StageResponse> => {
    const { supabase, userId } = context;
    const aiKey = process.env["LOVABLE_API_KEY"];
    const { data: scan } = await supabase.from("scans").select("*").eq("id", data.scanId).eq("user_id", userId).maybeSingle();
    if (!scan) return { ok: false, code: "NOT_FOUND", message: "Scan not found." };
    if (!aiKey) return fail(supabase, userId, scan.id, new ScanError("AI_UNAVAILABLE", "AI analysis is unavailable — AI service is not configured."));
    try {
      const { data: reviews, error } = await supabase.from("reviews").select("*").eq("scan_id", scan.id);
      if (error) throw new ScanError("DB_UNAVAILABLE", "Database unavailable.");
      if (!reviews?.length) throw new ScanError("INSUFFICIENT_DATA", "Insufficient data — no reviews to analyze.");
      const analysis = await analyzeReviews(aiKey, scan.business_name ?? "", scan.category, reviews.map((r) => ({
        author: r.author, authorUri: r.author_uri, rating: r.rating, publishedAt: r.published_at, relativeTime: r.relative_time, text: r.text ?? "", reviewUri: r.review_uri,
      })));
      const ins = await supabase.from("review_analyses").insert(reviews.map((r, i) => ({ review_id: r.id, scan_id: scan.id, model: ANALYSIS_MODEL, analysis_provider: AI_PROVIDER, analysis_version: APP_VERSION, ...analysis[i]! })));
      if (ins.error) throw new ScanError("DB_UNAVAILABLE", "Database unavailable — analysis could not be saved.");
      const n = (k: string) => analysis.filter((a) => a.risk === k).length;
      const high = n("high"), medium = n("medium");
      await supabase.from("scans").update({
        status: "complete", stage: "done", high_count: high, medium_count: medium, normal_count: n("normal"), requires_review_count: n("requires_review"), completed_at: new Date().toISOString(),
      }).eq("id", scan.id);
      const recommended = high + medium > 0
        ? `Review the ${high + medium} flagged review(s) and, where you believe Google policy is violated, report each one through the official Google reporting path with the evidence below.`
        : "No potentially risky reviews detected among the available reviews. No reporting action recommended.";
      await supabase.from("reports").insert({
        scan_id: scan.id, user_id: userId, report_number: "RPT-" + scan.id.replace(/-/g, "").slice(0, 8).toUpperCase(), recommended_action: recommended,
        summary: `${reviews.length} available review(s) analyzed: ${high} high, ${medium} medium, ${n("normal")} normal, ${n("requires_review")} requires review.`,
        high_risk_count: high, medium_risk_count: medium, normal_count: n("normal"),
        report_data: { business: scan.business_name, rating: scan.rating, total_reviews: scan.total_reviews, reviews_retrieved: reviews.length, analysis_version: APP_VERSION, model: ANALYSIS_MODEL },
      });
      await audit(supabase, userId, "scan.completed", { scan_id: scan.id, high, medium });
      return { ok: true, scanId: scan.id, reviews: reviews.length };
    } catch (e) {
      return fail(supabase, userId, scan.id, e);
    }
  });

async function fail(supabase: any, userId: string, scanId: string, e: unknown): Promise<StageResponse> {
  const code = e instanceof ScanError ? e.code : "UNKNOWN";
  const message = e instanceof Error ? e.message : "Unexpected error.";
  console.error("scan failed", code, message);
  await supabase.from("scans").update({ status: "failed", error: message, completed_at: new Date().toISOString() }).eq("id", scanId);
  await audit(supabase, userId, "scan.failed", { scan_id: scanId, code });
  return { ok: false, code, message, scanId };
}

export const logAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ action: z.enum(["report.downloaded", "settings.password_changed", "settings.profile_updated", "auth.logout_all"]), detail: z.record(z.string(), z.string()).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await audit(context.supabase, context.userId, data.action, data.detail ?? {});
    return { ok: true };
  });

export const getAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("audit_log").select("action, created_at").order("created_at", { ascending: false }).limit(8);
    return data ?? [];
  });

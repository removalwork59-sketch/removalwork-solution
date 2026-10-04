import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ScanError, resolveAndFetchPlace } from "./google-places.server";
import { analyzeReviews, ANALYSIS_MODEL } from "./analysis.server";

export const getSystemStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.from("scans").select("id", { head: true, count: "exact" });
    return {
      googleConfigured: Boolean(process.env["GOOGLE_PLACES_API_KEY"]),
      aiConfigured: Boolean(process.env["LOVABLE_API_KEY"]),
      aiModel: ANALYSIS_MODEL,
      databaseOk: !error,
      reviewLimit: 5,
    };
  });

export type ScanResponse = { ok: true; scanId: string } | { ok: false; code: string; message: string; scanId?: string };

export const runScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().trim().min(5).max(2000) }).parse(d))
  .handler(async ({ data, context }): Promise<ScanResponse> => {
    const { supabase, userId } = context;
    let urlOk = false;
    try { const u = new URL(data.url); urlOk = /google\.|goo\.gl|g\.page/.test(u.hostname); } catch { /* invalid */ }
    if (!urlOk) return { ok: false, code: "INVALID_URL", message: "Paste a Google Maps business link (google.com/maps/… or maps.app.goo.gl/…)." };

    const googleKey = process.env["GOOGLE_PLACES_API_KEY"];
    if (!googleKey) return { ok: false, code: "API_KEY_REQUIRED", message: "Google Places API key is not configured yet. Add it to enable live scans." };
    const aiKey = process.env["LOVABLE_API_KEY"];
    if (!aiKey) return { ok: false, code: "API_UNAVAILABLE", message: "AI analysis is not configured." };

    const { data: scan, error } = await supabase.from("scans")
      .insert({ user_id: userId, source_url: data.url, status: "running", data_source: "google_places" })
      .select("id").single();
    if (error || !scan) return { ok: false, code: "DB", message: "Could not save the scan. Try again." };

    try {
      const place = await resolveAndFetchPlace(googleKey, data.url);
      if (place.reviews.length === 0) throw new ScanError("INSUFFICIENT_DATA", "Google returned no reviews for this business.");
      const analysis = await analyzeReviews(aiKey, place.name, place.reviews);
      const rows = place.reviews.map((r, i) => ({
        scan_id: scan.id, author: r.author, author_uri: r.authorUri, rating: r.rating,
        published_at: r.publishedAt, relative_time: r.relativeTime, text: r.text, review_uri: r.reviewUri,
        ...analysis[i],
      }));
      const ins = await supabase.from("reviews").insert(rows);
      if (ins.error) throw new ScanError("DB", "Could not save reviews.");
      const count = (k: string) => analysis.filter((a) => a.risk === k).length;
      await supabase.from("scans").update({
        place_id: place.placeId, business_name: place.name, category: place.category, address: place.address,
        rating: place.rating, total_reviews: place.totalReviews, maps_uri: place.mapsUri, status: "complete",
        high_count: count("high"), medium_count: count("medium"), normal_count: count("normal"),
      }).eq("id", scan.id);
      return { ok: true, scanId: scan.id };
    } catch (e) {
      const code = e instanceof ScanError ? e.code : "UNKNOWN";
      const message = e instanceof Error ? e.message : "Unexpected error.";
      console.error("scan failed", code, message);
      await supabase.from("scans").update({ status: "failed", error: message }).eq("id", scan.id);
      return { ok: false, code, message, scanId: scan.id };
    }
  });

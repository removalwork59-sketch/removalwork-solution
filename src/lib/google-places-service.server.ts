// GooglePlacesService — single entry point for Google Places API (New).
// Reads GOOGLE_MAPS_API_KEY (or GOOGLE_PLACES_API_KEY). Returns GOOGLE_API_NOT_CONFIGURED when absent.
import { ScanError, resolveAndFetchPlace, parseMapsUrl, type PlaceResult, type PlaceReview } from "./google-places.server";

export const GOOGLE_REPORT_HELP_URL = "https://support.google.com/business/answer/4596773";

export function getGoogleKey(): string | null {
  return process.env["GOOGLE_MAPS_API_KEY"] || process.env["GOOGLE_PLACES_API_KEY"] || null;
}

function requireKey(): string {
  const k = getGoogleKey();
  if (!k) throw new ScanError("GOOGLE_API_NOT_CONFIGURED", "Google Places API is not configured.");
  return k;
}

export const GooglePlacesService = {
  isConfigured: () => Boolean(getGoogleKey()),
  /** Parse a Maps URL into a place id / query without calling Google. */
  resolvePlace: (url: string) => parseMapsUrl(url),
  /** Resolve the business and read supported details plus available reviews (max 5 from Google). */
  getPlaceDetails: (url: string): Promise<PlaceResult> => resolveAndFetchPlace(requireKey(), url),
  getAvailableReviews: async (url: string): Promise<PlaceReview[]> => (await resolveAndFetchPlace(requireKey(), url)).reviews,
  buildReviewLinks: (place: Pick<PlaceResult, "mapsUri" | "reviews">) => ({
    business: place.mapsUri,
    reviews: place.reviews.map((r) => r.reviewUri),
    officialReportingHelp: GOOGLE_REPORT_HELP_URL,
  }),
};

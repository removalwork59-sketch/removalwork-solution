// Official Google Places API (New) integration boundary.
// Requires GOOGLE_PLACES_API_KEY. Google returns at most 5 reviews per place.

export class ScanError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export type PlaceReview = {
  author: string;
  authorUri: string | null;
  rating: number;
  publishedAt: string | null;
  relativeTime: string | null;
  text: string;
  reviewUri: string | null;
};

export type PlaceResult = {
  placeId: string;
  name: string;
  category: string | null;
  address: string | null;
  rating: number | null;
  totalReviews: number | null;
  mapsUri: string | null;
  latitude: number | null;
  longitude: number | null;
  reviews: PlaceReview[];
};

const BASE = "https://places.googleapis.com/v1";

async function googleFetch(apiKey: string, path: string, init: RequestInit & { fieldMask: string }) {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": init.fieldMask,
      },
    });
  } catch {
    throw new ScanError("NETWORK", "Could not reach Google. Check your connection and try again.");
  }
  if (res.status === 429) throw new ScanError("RATE_LIMIT", "Google rate limit reached. Wait a minute and try again.");
  if (res.status === 403 || res.status === 401) {
    const body = await res.text();
    throw new ScanError("API_UNAVAILABLE", `Google rejected the API key. Make sure Places API (New) is enabled for it. (${body.slice(0, 200)})`);
  }
  if (res.status === 404) throw new ScanError("NOT_FOUND", "Business not found on Google.");
  if (res.status >= 500) throw new ScanError("GOOGLE_ERROR", "Google service is temporarily unavailable. Try again shortly.");
  if (!res.ok) {
    const body = await res.text();
    throw new ScanError("GOOGLE_ERROR", `Google request failed [${res.status}]: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function expandShortLink(url: string): Promise<string> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    return res.url || url;
  } catch {
    return url;
  }
}

type Parsed = { placeId?: string; query?: string; lat?: number; lng?: number; cid?: string };

export function parseMapsUrl(raw: string): Parsed {
  const url = new URL(raw);
  const p = url.searchParams;
  const pid = p.get("query_place_id") || p.get("place_id") || p.get("cid_place_id");
  if (pid) return { placeId: pid };
  // Review-share links (maps.app.goo.gl → /maps/reviews/data=…) carry the
  // business as a hex CID like !1s0x0:0x31fa1495830fb5a — convert to decimal.
  const hexCid = raw.match(/!1s0x[0-9a-f]+:0x([0-9a-f]+)/i)?.[1];
  if (hexCid) return { cid: BigInt(`0x${hexCid}`).toString(10) };
  const cidParam = p.get("cid");
  if (cidParam && /^\d+$/.test(cidParam)) return { cid: cidParam };
  const q = p.get("q") || p.get("query");
  if (q?.startsWith("place_id:")) return { placeId: q.slice(9) };
  const out: Parsed = {};
  const placeMatch = url.pathname.match(/\/maps\/place\/([^/]+)/);
  if (placeMatch) out.query = decodeURIComponent((placeMatch[1] ?? "").replace(/\+/g, " "));
  else if (q) out.query = q;
  const at = url.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) { out.lat = Number(at[1]); out.lng = Number(at[2]); }
  return out;
}

const DETAILS_MASK = "id,displayName,formattedAddress,rating,userRatingCount,googleMapsUri,primaryTypeDisplayName,reviews,location";

export async function resolveAndFetchPlace(apiKey: string, inputUrl: string): Promise<PlaceResult> {
  let url = inputUrl.trim();
  if (/goo\.gl|g\.page|maps\.app/.test(url)) url = await expandShortLink(url);
  let parsed: Parsed;
  try { parsed = parseMapsUrl(url); } catch { throw new ScanError("INVALID_URL", "That doesn't look like a valid Google Maps link."); }

  let placeId = parsed.placeId;
  if (!placeId) {
    if (!parsed.query) throw new ScanError("INVALID_URL", "Couldn't find a business in that link. Open the business on Google Maps and copy its link.");
    const body: Record<string, unknown> = { textQuery: parsed.query, pageSize: 1 };
    if (parsed.lat != null && parsed.lng != null) {
      body["locationBias"] = { circle: { center: { latitude: parsed.lat, longitude: parsed.lng }, radius: 2000 } };
    }
    const search = await googleFetch(apiKey, "/places:searchText", { method: "POST", body: JSON.stringify(body), fieldMask: "places.id" });
    placeId = search?.places?.[0]?.id;
    if (!placeId) throw new ScanError("NOT_FOUND", "Business not found on Google. Try a different link.");
  }

  const d = await googleFetch(apiKey, `/places/${encodeURIComponent(placeId)}`, { method: "GET", fieldMask: DETAILS_MASK });
  const reviews: PlaceReview[] = (d.reviews ?? []).map((r: any) => ({
    author: r.authorAttribution?.displayName ?? "Google user",
    authorUri: r.authorAttribution?.uri ?? null,
    rating: r.rating ?? 0,
    publishedAt: r.publishTime ?? null,
    relativeTime: r.relativePublishTimeDescription ?? null,
    text: r.text?.text ?? r.originalText?.text ?? "",
    reviewUri: r.googleMapsUri ?? null,
  }));
  return {
    placeId: d.id,
    name: d.displayName?.text ?? "Unknown business",
    category: d.primaryTypeDisplayName?.text ?? null,
    address: d.formattedAddress ?? null,
    rating: d.rating ?? null,
    totalReviews: d.userRatingCount ?? null,
    mapsUri: d.googleMapsUri ?? null,
    latitude: d.location?.latitude ?? null,
    longitude: d.location?.longitude ?? null,
    reviews,
  };
}

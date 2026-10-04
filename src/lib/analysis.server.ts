import type { PlaceReview } from "./google-places.server";
import { ScanError } from "./google-places.server";

export type ReviewAnalysis = {
  risk: "high" | "medium" | "normal";
  policy_category: string | null;
  indicators: string[];
  reason: string;
  evidence: string | null;
  confidence: number;
};

export const ANALYSIS_MODEL = "google/gemini-3-flash-preview";

const SYSTEM = `You assess Google reviews against Google's prohibited & restricted content policy
(spam/fake engagement, off-topic, conflict of interest, harassment, hate speech, personal information,
profanity, illegal content, impersonation, not based on real experience).
Be conservative: genuine negative experiences are NORMAL. Only flag clear signals.
For each review return risk (high|medium|normal), policy_category (or null), short indicators,
a one-sentence reason, evidence as exact quotes from the text (or null), and confidence 0-100.`;

export async function analyzeReviews(apiKey: string, businessName: string, reviews: PlaceReview[]): Promise<ReviewAnalysis[]> {
  if (reviews.length === 0) return [];
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Business: ${businessName}\n\n` + reviews.map((r, i) => `#${i} (${r.rating}★): ${r.text || "(no text)"}`).join("\n\n") },
      ],
      tools: [{
        type: "function",
        function: {
          name: "report",
          parameters: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "integer" },
                    risk: { type: "string", enum: ["high", "medium", "normal"] },
                    policy_category: { type: ["string", "null"] },
                    indicators: { type: "array", items: { type: "string" } },
                    reason: { type: "string" },
                    evidence: { type: ["string", "null"] },
                    confidence: { type: "integer" },
                  },
                  required: ["index", "risk", "indicators", "reason", "confidence"],
                },
              },
            },
            required: ["results"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "report" } },
    }),
  });
  if (res.status === 429) throw new ScanError("RATE_LIMIT", "AI analysis is rate limited. Try again in a minute.");
  if (res.status === 402) throw new ScanError("API_UNAVAILABLE", "AI analysis credits are exhausted. Add credits in workspace settings.");
  if (!res.ok) throw new ScanError("API_UNAVAILABLE", `AI analysis failed [${res.status}].`);
  const json = await res.json();
  const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  let results: any[] = [];
  try { results = JSON.parse(args ?? "{}").results ?? []; } catch { /* fallthrough */ }
  return reviews.map((_, i) => {
    const r = results.find((x) => x.index === i);
    if (!r) return { risk: "normal", policy_category: null, indicators: [], reason: "Not assessed.", evidence: null, confidence: 0 };
    return {
      risk: ["high", "medium", "normal"].includes(r.risk) ? r.risk : "normal",
      policy_category: r.policy_category ?? null,
      indicators: Array.isArray(r.indicators) ? r.indicators.slice(0, 6) : [],
      reason: String(r.reason ?? ""),
      evidence: r.evidence ?? null,
      confidence: Math.max(0, Math.min(100, Number(r.confidence) || 0)),
    };
  });
}

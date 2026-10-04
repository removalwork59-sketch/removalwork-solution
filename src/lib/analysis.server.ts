import type { PlaceReview } from "./google-places.server";
import { ScanError } from "./google-places.server";

export type RiskLevel = "high" | "medium" | "normal" | "requires_review";

export type ReviewAnalysis = {
  risk: RiskLevel;
  category: string | null;
  signals: string[];
  reason: string;
  evidence: string | null;
  confidence: number;
};

export const ANALYSIS_MODEL = "google/gemini-3-flash-preview";
export const AI_PROVIDER = "Lovable AI Gateway";

const SYSTEM = `You assess the policy risk of Google reviews against Google's prohibited & restricted content policy.
Signals to consider: potential spam, irrelevant/off-topic content, abusive language, potentially deceptive content,
conflict with business context, promotional content, repeated/suspicious patterns, conflict of interest,
personal information, not based on real experience.
CRITICAL: a NEGATIVE review is NOT a policy violation. Genuine negative feedback about a real experience is "normal".
Use "requires_review" when the text is ambiguous or too short to judge.
For each review return: risk (high|medium|normal|requires_review), category (short label or null),
signals (short phrases), reason (one sentence, transparent, never claim certainty of a violation),
evidence (exact quotes from the review text or null), confidence 0-100.`;

export async function analyzeReviews(apiKey: string, businessName: string, category: string | null, reviews: PlaceReview[]): Promise<ReviewAnalysis[]> {
  if (reviews.length === 0) return [];
  let res: Response;
  try {
    res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ANALYSIS_MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Business: ${businessName}${category ? ` (${category})` : ""}\n\n` + reviews.map((r, i) => `#${i} (${r.rating}★, ${r.relativeTime ?? "date unknown"}): ${r.text || "(no text)"}`).join("\n\n") },
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
                      risk: { type: "string", enum: ["high", "medium", "normal", "requires_review"] },
                      category: { type: ["string", "null"] },
                      signals: { type: "array", items: { type: "string" } },
                      reason: { type: "string" },
                      evidence: { type: ["string", "null"] },
                      confidence: { type: "integer" },
                    },
                    required: ["index", "risk", "signals", "reason", "confidence"],
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
  } catch {
    throw new ScanError("AI_UNAVAILABLE", "AI analysis is unavailable (network error). Try again.");
  }
  if (res.status === 429) throw new ScanError("RATE_LIMIT", "AI analysis is rate limited. Try again in a minute.");
  if (res.status === 402) throw new ScanError("AI_UNAVAILABLE", "AI analysis credits are exhausted. Add credits in workspace settings.");
  if (!res.ok) throw new ScanError("AI_UNAVAILABLE", `AI analysis is unavailable [${res.status}].`);
  const json = await res.json();
  const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  let results: any[] = [];
  try { results = JSON.parse(args ?? "{}").results ?? []; } catch { /* handled below */ }
  const valid: RiskLevel[] = ["high", "medium", "normal", "requires_review"];
  return reviews.map((_, i) => {
    const r = results.find((x) => x.index === i);
    if (!r) return { risk: "requires_review", category: null, signals: [], reason: "The analysis engine did not return a result for this review.", evidence: null, confidence: 0 };
    return {
      risk: valid.includes(r.risk) ? r.risk : "requires_review",
      category: r.category ?? null,
      signals: Array.isArray(r.signals) ? r.signals.slice(0, 6).map(String) : [],
      reason: String(r.reason ?? ""),
      evidence: r.evidence ?? null,
      confidence: Math.max(0, Math.min(100, Number(r.confidence) || 0)),
    };
  });
}

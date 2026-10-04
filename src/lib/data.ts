import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Scan = Tables<"scans">;
export type Review = Tables<"reviews">;
export type Risk = "high" | "medium" | "normal";

export const scansQuery = () =>
  queryOptions({
    queryKey: ["scans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("scans").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const scanQuery = (id: string) =>
  queryOptions({
    queryKey: ["scan", id],
    queryFn: async () => {
      const [s, r] = await Promise.all([
        supabase.from("scans").select("*").eq("id", id).maybeSingle(),
        supabase.from("reviews").select("*").eq("scan_id", id).order("confidence", { ascending: false }),
      ]);
      if (s.error) throw s.error;
      if (r.error) throw r.error;
      const order = { high: 0, medium: 1, normal: 2 } as Record<string, number>;
      return { scan: s.data, reviews: (r.data ?? []).sort((a, b) => order[a.risk] - order[b.risk]) };
    },
  });

export function scanRisk(s: Scan): Risk {
  if (s.high_count > 0) return "high";
  if (s.medium_count > 0) return "medium";
  return "normal";
}

export const reportId = (id: string) => "SV-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
export const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

export const GOOGLE_REPORT_URL = "https://support.google.com/business/workflow/9945796";
export const GOOGLE_POLICY_URL = "https://support.google.com/contributionpolicy/answer/7400114";

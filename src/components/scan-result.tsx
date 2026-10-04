import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin, ExternalLink, FileText, Info } from "lucide-react";
import type { Review, Scan } from "@/lib/data";
import { Stars, ReviewCard, ReviewDrawer, SeedBadge } from "./review-ui";
import { Button } from "@/components/ui/button";

export function BusinessHeader({ scan }: { scan: Scan }) {
  const rating = scan.rating != null ? Number(scan.rating) : null;
  return (
    <div className="surface animate-rise overflow-hidden">
      <div className="bg-scanner h-2" />
      <div className="flex flex-wrap items-center justify-between gap-6 p-6">
        <div className="space-y-2">
          {scan.is_seed && <SeedBadge />}
          <h2 className="text-2xl font-bold tracking-tight">{scan.business_name}</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {scan.category && <span>{scan.category}</span>}
            {scan.address && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{scan.address}</span>}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <span className="font-mono text-4xl font-semibold tabular">{rating?.toFixed(1) ?? "—"}</span>
              {rating != null && <Stars value={rating} size={18} />}
            </div>
            <div className="text-sm text-muted-foreground">{scan.total_reviews?.toLocaleString() ?? "—"} Google reviews</div>
          </div>
          {scan.maps_uri && !scan.is_seed && (
            <Button variant="outline" asChild><a href={scan.maps_uri} target="_blank" rel="noreferrer"><ExternalLink /> Open Google Maps</a></Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function RiskAnalysis({ scan, reviews, showReportLink = true }: { scan: Scan; reviews: Review[]; showReportLink?: boolean }) {
  const [open, setOpen] = useState<Review | null>(null);
  const tiles = [
    { label: "High risk", desc: "Potentially problematic reviews.", v: scan.high_count, cls: "bg-risk-high-soft text-risk-high" },
    { label: "Medium risk", desc: "Reviews requiring additional review.", v: scan.medium_count, cls: "bg-risk-medium-soft text-risk-medium" },
    { label: "Normal", desc: "No significant detected risk.", v: scan.normal_count, cls: "bg-risk-normal-soft text-risk-normal" },
  ];
  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Review Risk Analysis</h2>
        {showReportLink && <Button variant="outline" asChild><Link to="/reports/$id" params={{ id: scan.id }}><FileText /> View report</Link></Button>}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className={`rounded-xl p-5 ${t.cls}`}>
            <div className="text-xs font-bold uppercase tracking-wider">{t.label}</div>
            <div className="mt-1 font-mono text-3xl font-semibold">{t.v}</div>
            <div className="mt-1 text-sm opacity-80">{t.desc}</div>
          </div>
        ))}
      </div>
      {!scan.is_seed && (
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Google's official Places API returns up to 5 reviews per business. Analysis covers the reviews Google makes available.
        </p>
      )}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {reviews.map((r) => <ReviewCard key={r.id} review={r} isSeed={scan.is_seed} onOpen={() => setOpen(r)} />)}
      </div>
      <ReviewDrawer review={open} scan={scan} onClose={() => setOpen(null)} />
    </section>
  );
}

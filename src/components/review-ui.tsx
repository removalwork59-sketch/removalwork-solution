import { Star, ExternalLink, Flag, ShieldAlert, ShieldCheck, ShieldQuestion, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { GOOGLE_REPORT_URL, type Review, type Risk, type Scan, fmtDate } from "@/lib/data";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-border" fill="currentColor" strokeWidth={0} style={{ width: size, height: size }} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="text-star" fill="currentColor" strokeWidth={0} style={{ width: size, height: size }} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

const riskMeta: Record<Risk, { label: string; cls: string; Icon: typeof ShieldAlert }> = {
  high: { label: "High risk", cls: "bg-risk-high-soft text-risk-high", Icon: ShieldAlert },
  medium: { label: "Medium risk", cls: "bg-risk-medium-soft text-risk-medium", Icon: ShieldQuestion },
  normal: { label: "Normal", cls: "bg-risk-normal-soft text-risk-normal", Icon: ShieldCheck },
};

export function RiskBadge({ risk, className }: { risk: string; className?: string }) {
  const m = riskMeta[(risk as Risk) in riskMeta ? (risk as Risk) : "normal"];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", m.cls, className)}>
      <m.Icon className="h-3.5 w-3.5" /> {m.label}
    </span>
  );
}

export function SeedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-risk-medium bg-risk-medium-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-risk-medium">
      <FlaskConical className="h-3 w-3" /> Demo seed data — not live Google data
    </span>
  );
}

export function ReviewCard({ review, onOpen, isSeed }: { review: Review; onOpen: () => void; isSeed?: boolean }) {
  return (
    <article className="surface surface-hover animate-rise p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft font-semibold text-brand">
            {review.author.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold">{review.author}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Stars value={review.rating} size={12} /> {review.relative_time ?? fmtDate(review.published_at)}
            </div>
          </div>
        </div>
        <RiskBadge risk={review.risk} />
      </div>
      <p className="mt-4 line-clamp-4 text-[15px] leading-relaxed">{review.text || <em className="text-muted-foreground">No review text</em>}</p>
      {review.risk !== "normal" && (
        <div className="mt-4 grid gap-3 rounded-lg bg-muted p-3 text-sm sm:grid-cols-[1fr_auto]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{review.policy_category ?? "Potential policy issue"}</div>
            <div className="mt-1">{review.reason}</div>
            {review.indicators.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {review.indicators.map((i) => <span key={i} className="rounded-md bg-card px-2 py-0.5 text-xs">{i}</span>)}
              </div>
            )}
          </div>
          <Confidence value={review.confidence} />
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onOpen}>Details</Button>
        {!isSeed && review.review_uri && (
          <Button size="sm" variant="ghost" asChild><a href={review.review_uri} target="_blank" rel="noreferrer"><ExternalLink /> View on Google</a></Button>
        )}
        {!isSeed && review.risk !== "normal" && (
          <Button size="sm" variant="ghost" asChild><a href={GOOGLE_REPORT_URL} target="_blank" rel="noreferrer"><Flag /> Report on Google</a></Button>
        )}
      </div>
    </article>
  );
}

export function Confidence({ value }: { value: number }) {
  return (
    <div className="text-right">
      <div className="text-xs text-muted-foreground">Confidence</div>
      <div className="font-mono text-2xl font-semibold tabular">{value}%</div>
      <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-border">
        <div className="h-full bg-brand transition-all duration-700" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function ReviewDrawer({ review, scan, onClose }: { review: Review | null; scan: Scan | null; onClose: () => void }) {
  return (
    <Sheet open={!!review} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {review && (
          <>
            <SheetHeader>
              <SheetTitle className="text-xl">{review.author}</SheetTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Stars value={review.rating} /> · {review.relative_time ?? fmtDate(review.published_at)}
              </div>
            </SheetHeader>
            <div className="space-y-6 px-4 pb-8">
              {scan?.is_seed && <SeedBadge />}
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{review.text || "No review text available."}</p>
              <div className="surface space-y-4 p-4">
                <div className="flex items-center justify-between"><span className="text-sm font-semibold">Risk assessment</span><RiskBadge risk={review.risk} /></div>
                <Field label="Policy category" value={review.policy_category ?? "None detected"} />
                <Field label="Detection reason" value={review.reason ?? "—"} />
                <Field label="Evidence" value={review.evidence ?? "—"} />
                {review.indicators.length > 0 && <Field label="Indicators" value={review.indicators.join(" · ")} />}
                <Confidence value={review.confidence} />
              </div>
              {!scan?.is_seed && (
                <div className="flex flex-col gap-2">
                  <Button asChild><a href={GOOGLE_REPORT_URL} target="_blank" rel="noreferrer"><Flag /> Open Google reporting path</a></Button>
                  {(review.review_uri || scan?.maps_uri) && (
                    <Button variant="outline" asChild><a href={review.review_uri ?? scan!.maps_uri!} target="_blank" rel="noreferrer"><ExternalLink /> View review on Google</a></Button>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Google independently determines whether content violates its policies and whether removal is appropriate.</p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

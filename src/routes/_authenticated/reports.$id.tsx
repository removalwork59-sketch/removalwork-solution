import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { z } from "zod";
import { ArrowLeft, Download, Flag } from "lucide-react";
import { scanQuery, fmtDate, reportId, GOOGLE_REPORT_URL } from "@/lib/data";
import { Stars, RiskBadge, SeedBadge } from "@/components/review-ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reports/$id")({
  validateSearch: z.object({ print: z.boolean().optional() }),
  head: () => ({ meta: [{ title: "Review Risk Report — SEO Vale" }, { name: "description", content: "Google review risk evidence report." }] }),
  component: ReportDetail,
});

function ReportDetail() {
  const { id } = Route.useParams();
  const { print } = Route.useSearch();
  const { data, isLoading } = useQuery(scanQuery(id));
  useEffect(() => { if (print && data?.scan) setTimeout(() => window.print(), 400); }, [print, data]);

  if (isLoading) return <div className="text-muted-foreground">Preparing report…</div>;
  if (!data?.scan) return <div>Report not found. <Link to="/reports" className="text-brand">Back to reports</Link></div>;
  const { scan, reviews } = data;
  const flagged = reviews.filter((r) => r.risk !== "normal");

  return (
    <>
      <div className="no-print mb-6 flex flex-wrap justify-between gap-3">
        <Button variant="ghost" asChild><Link to="/reports"><ArrowLeft /> Reports</Link></Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Download /> Download PDF</Button>
          {!scan.is_seed && <Button asChild><a href={GOOGLE_REPORT_URL} target="_blank" rel="noreferrer"><Flag /> Open Google reporting path</a></Button>}
        </div>
      </div>
      <article className="surface mx-auto max-w-4xl p-8 sm:p-12">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
          <div>
            <div className="text-xs font-bold tracking-[0.25em] text-brand">SEO VALE</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Google Review Risk Report</h1>
            {scan.is_seed && <div className="mt-2"><SeedBadge /></div>}
          </div>
          <div className="text-right font-mono text-xs text-muted-foreground">{reportId(scan.id)}<br />{fmtDate(scan.created_at)}</div>
        </header>
        <dl className="grid gap-4 py-6 text-sm sm:grid-cols-2">
          <Item k="Business" v={scan.business_name ?? "—"} />
          <Item k="Google rating" v={<span className="flex items-center gap-2"><span className="font-mono">{scan.rating != null ? Number(scan.rating).toFixed(1) : "—"}</span>{scan.rating != null && <Stars value={Number(scan.rating)} />} <span className="text-muted-foreground">({scan.total_reviews?.toLocaleString() ?? "—"})</span></span>} />
          <Item k="Scan date" v={fmtDate(scan.created_at)} />
          <Item k="Google Maps" v={scan.maps_uri ? <a href={scan.maps_uri} className="break-all text-brand">{scan.maps_uri}</a> : scan.source_url} />
        </dl>
        <section className="border-t py-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Executive summary</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Reviews analyzed", reviews.length, ""], ["High risk", scan.high_count, "text-risk-high"], ["Medium risk", scan.medium_count, "text-risk-medium"], ["Normal", scan.normal_count, "text-risk-normal"]].map(([l, v, c]) => (
              <div key={l as string} className="rounded-lg bg-muted p-4"><div className="text-xs text-muted-foreground">{l}</div><div className={`font-mono text-2xl font-semibold ${c}`}>{v}</div></div>
            ))}
          </div>
          {!scan.is_seed && <p className="mt-3 text-xs text-muted-foreground">Source: Google Places API (New). Google provides up to 5 reviews per business through its official API.</p>}
        </section>
        <section className="border-t py-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Review findings ({flagged.length} flagged)</h2>
          <div className="mt-4 space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="break-inside-avoid rounded-xl border p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-sm"><b>{r.author}</b><Stars value={r.rating} size={12} /><span className="text-muted-foreground">{r.relative_time ?? fmtDate(r.published_at)}</span></div>
                  <RiskBadge risk={r.risk} />
                </div>
                <p className="mt-3 text-[15px] leading-relaxed">{r.text}</p>
                {r.risk !== "normal" && (
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <Item k="Potential policy category" v={r.policy_category ?? "—"} />
                    <Item k="Confidence" v={<span className="font-mono">{r.confidence}%</span>} />
                    <Item k="Detection reason" v={r.reason ?? "—"} />
                    <Item k="Evidence" v={r.evidence ?? "—"} />
                    {r.review_uri && <Item k="Google review link" v={<a href={r.review_uri} className="break-all text-brand">{r.review_uri}</a>} />}
                  </dl>
                )}
              </div>
            ))}
          </div>
        </section>
        <footer className="border-t pt-6 text-xs text-muted-foreground">
          Classification is automated and advisory. Google independently determines whether content violates its policies and whether removal is appropriate. Report via Google's official review management path: {GOOGLE_REPORT_URL}
        </footer>
      </article>
    </>
  );
}

function Item({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt><dd className="mt-1">{v}</dd></div>;
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { scansQuery, scanRisk, fmtDate } from "@/lib/data";
import { PageHeader, EmptyState } from "@/components/app-shell";
import { Stars, RiskBadge } from "@/components/review-ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SEO Vale" }, { name: "description", content: "Overview of Google review scans and risk." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: scans = [], isLoading } = useQuery(scansQuery());
  const done = scans.filter((s) => s.status === "complete");
  const sum = (k: "high_count" | "medium_count" | "normal_count") => done.reduce((a, s) => a + s[k], 0);
  const high = sum("high_count"), med = sum("medium_count"), norm = sum("normal_count");
  const total = high + med + norm;
  const kpis = [
    { label: "Total Scans", value: scans.length },
    { label: "Businesses Scanned", value: new Set(done.map((s) => s.place_id ?? s.business_name)).size },
    { label: "Reviews Analyzed", value: total },
    { label: "High-Risk Reviews", value: high, accent: true },
  ];

  return (
    <>
      <PageHeader title="Google Review Scanner" subtitle="Scan, analyze and report potentially problematic Google reviews."
        action={<Button asChild size="lg"><Link to="/scan"><Plus /> New Scan</Link></Button>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <div key={k.label} className="surface surface-hover animate-rise p-5" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="text-sm text-muted-foreground">{k.label}</div>
            <div className={`mt-2 font-mono text-3xl font-semibold tabular ${k.accent ? "text-risk-high" : ""}`}>{isLoading ? "—" : k.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-semibold">Recent scans</h2>
            <Link to="/history" className="text-sm text-brand hover:underline">View all</Link>
          </div>
          {!isLoading && scans.length === 0 ? (
            <div className="p-6"><EmptyState title="No scans yet." action={<Button asChild><Link to="/scan">Start first scan</Link></Button>} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>{["Business", "Google Rating", "Reviews Found", "Risk", "Scan Date", ""].map((h) => <th key={h} className="px-5 py-3 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {scans.slice(0, 6).map((s) => (
                    <tr key={s.id} className="border-t hover:bg-muted/50">
                      <td className="px-5 py-3 font-medium">{s.business_name ?? s.source_url.slice(0, 40)}{s.is_seed && <span className="ml-2 text-[10px] font-semibold uppercase text-risk-medium">Demo</span>}</td>
                      <td className="px-5 py-3">{s.rating != null ? <span className="flex items-center gap-1.5"><span className="font-mono">{Number(s.rating).toFixed(1)}</span><Stars value={Number(s.rating)} size={12} /></span> : "—"}</td>
                      <td className="px-5 py-3 font-mono">{s.high_count + s.medium_count + s.normal_count}</td>
                      <td className="px-5 py-3">{s.status === "complete" ? <RiskBadge risk={scanRisk(s)} /> : <span className="text-xs capitalize text-muted-foreground">{s.status}</span>}</td>
                      <td className="px-5 py-3 text-muted-foreground">{fmtDate(s.created_at)}</td>
                      <td className="px-5 py-3 text-right">{s.status === "complete" && <Link to="/reports/$id" params={{ id: s.id }} className="text-brand hover:underline">Open</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="surface p-5">
          <h2 className="font-semibold">Risk overview</h2>
          <div className="mt-5 space-y-4">
            {[["High Risk", high, "bg-risk-high"], ["Medium Risk", med, "bg-risk-medium"], ["Normal", norm, "bg-risk-normal"]].map(([l, v, c]) => (
              <div key={l as string}>
                <div className="flex justify-between text-sm"><span>{l}</span><span className="font-mono">{v as number}</span></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${c} transition-all duration-1000`} style={{ width: total ? `${((v as number) / total) * 100}%` : "0%" }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

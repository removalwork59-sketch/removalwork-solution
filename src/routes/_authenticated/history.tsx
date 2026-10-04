import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { scansQuery, scanRisk, fmtDate } from "@/lib/data";
import { PageHeader, EmptyState } from "@/components/app-shell";
import { RiskBadge } from "@/components/review-ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "Scan History — SEO Vale" }, { name: "description", content: "Searchable history of Google review scans." }] }),
  component: HistoryPage,
});

const sel = "h-9 rounded-md border bg-card px-3 text-sm";

function HistoryPage() {
  const { data: scans = [], isLoading } = useQuery(scansQuery());
  const [q, setQ] = useState(""); const [risk, setRisk] = useState("all"); const [status, setStatus] = useState("all"); const [since, setSince] = useState("all");
  const rows = useMemo(() => scans.filter((s) => {
    if (q && !`${s.business_name ?? ""} ${s.source_url}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (status !== "all" && s.status !== status) return false;
    if (risk !== "all" && (s.status !== "complete" || scanRisk(s) !== risk)) return false;
    if (since !== "all" && Date.now() - new Date(s.created_at).getTime() > Number(since) * 864e5) return false;
    return true;
  }), [scans, q, risk, status, since]);

  return (
    <>
      <PageHeader title="Scan History" subtitle="Every scan you've run." />
      <div className="surface mb-4 flex flex-wrap gap-3 p-3">
        <Input placeholder="Search business…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <select className={sel} value={since} onChange={(e) => setSince(e.target.value)}><option value="all">Any date</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select>
        <select className={sel} value={risk} onChange={(e) => setRisk(e.target.value)}><option value="all">Any risk</option><option value="high">High</option><option value="medium">Medium</option><option value="normal">Normal</option></select>
        <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Any status</option><option value="complete">Complete</option><option value="failed">Failed</option><option value="running">Running</option></select>
      </div>
      {!isLoading && scans.length === 0 ? <EmptyState title="No scan history available." action={<Button asChild><Link to="/scan">Start first scan</Link></Button>} /> : (
        <div className="surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{["Business", "Rating", "Reviews Found", "High", "Medium", "Scan Date", "Status", ""].map((h) => <th key={h} className="px-5 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t hover:bg-muted/50">
                  <td className="px-5 py-3 font-medium">{s.business_name ?? <span className="text-muted-foreground">{s.source_url.slice(0, 45)}</span>}{s.is_seed && <span className="ml-2 text-[10px] font-semibold uppercase text-risk-medium">Demo</span>}</td>
                  <td className="px-5 py-3 font-mono">{s.rating != null ? Number(s.rating).toFixed(1) : "—"}</td>
                  <td className="px-5 py-3 font-mono">{s.high_count + s.medium_count + s.normal_count}</td>
                  <td className="px-5 py-3 font-mono text-risk-high">{s.high_count}</td>
                  <td className="px-5 py-3 font-mono text-risk-medium">{s.medium_count}</td>
                  <td className="px-5 py-3 text-muted-foreground">{fmtDate(s.created_at)}</td>
                  <td className="px-5 py-3">{s.status === "complete" ? <RiskBadge risk={scanRisk(s)} /> : <span title={s.error ?? ""} className="text-xs capitalize text-muted-foreground">{s.status}</span>}</td>
                  <td className="px-5 py-3 text-right">{s.status === "complete" && <Link to="/reports/$id" params={{ id: s.id }} className="text-brand hover:underline">View</Link>}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">No scans match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

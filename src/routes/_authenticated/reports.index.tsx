import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye } from "lucide-react";
import { scansQuery, fmtDate, reportId } from "@/lib/data";
import { PageHeader, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reports/")({
  head: () => ({ meta: [{ title: "Reports — Review & Rating Scanner" }, { name: "description", content: "Google review risk evidence reports." }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: scans = [], isLoading } = useQuery(scansQuery());
  const reports = scans.filter((s) => s.status === "complete");
  return (
    <>
      <PageHeader title="Reports" subtitle="Evidence reports generated from completed scans." />
      {!isLoading && reports.length === 0 ? <EmptyState title="No reports generated yet." /> : (
        <div className="surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{["Report ID", "Business", "Reviews Analyzed", "High Risk", "Medium Risk", "Created", "Status", ""].map((h) => <th key={h} className="px-5 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {reports.map((s) => (
                <tr key={s.id} className="border-t hover:bg-muted/50">
                  <td className="px-5 py-3 font-mono text-xs">{reportId(s.id)}</td>
                  <td className="px-5 py-3 font-medium">{s.business_name}</td>
                  <td className="px-5 py-3 font-mono">{s.high_count + s.medium_count + s.normal_count}</td>
                  <td className="px-5 py-3 font-mono text-risk-high">{s.high_count}</td>
                  <td className="px-5 py-3 font-mono text-risk-medium">{s.medium_count}</td>
                  <td className="px-5 py-3 text-muted-foreground">{fmtDate(s.created_at)}</td>
                  <td className="px-5 py-3">{s.is_seed ? <span className="text-xs font-semibold uppercase text-risk-medium">Demo seed</span> : <span className="text-xs font-semibold text-risk-normal">Ready</span>}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" asChild><Link to="/reports/$id" params={{ id: s.id }}><Eye /> View</Link></Button>
                      <Button size="sm" variant="ghost" asChild><Link to="/reports/$id" params={{ id: s.id }} search={{ print: true }}><Download /> Download</Link></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

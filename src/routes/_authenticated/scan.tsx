import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Search, KeyRound, AlertTriangle } from "lucide-react";
import { runScan, getSystemStatus } from "@/lib/scan.functions";
import { scanQuery } from "@/lib/data";
import { BusinessHeader, RiskAnalysis } from "@/components/scan-result";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({ meta: [{ title: "New Scan — SEO Vale" }, { name: "description", content: "Scan a Google Maps business for review risk." }] }),
  component: ScanPage,
});

const STEPS = ["Resolving business", "Reading public business data", "Reading available reviews", "Analyzing reviews", "Preparing report"];

function ScanPage() {
  const status = useServerFn(getSystemStatus);
  const scan = useServerFn(runScan);
  const qc = useQueryClient();
  const { data: sys } = useQuery({ queryKey: ["system-status"], queryFn: () => status() });
  const [url, setUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => () => clearInterval(timer.current), []);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setScanId(null); setRunning(true); setStep(0);
    timer.current = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1800);
    try {
      const res = await scan({ data: { url } });
      if (res.ok) { setStep(STEPS.length); setScanId(res.scanId); }
      else setError({ code: res.code, message: res.message });
    } catch {
      setError({ code: "NETWORK", message: "Network error. Check your connection and try again." });
    } finally {
      clearInterval(timer.current);
      setRunning(false);
      qc.invalidateQueries({ queryKey: ["scans"] });
    }
  }

  const keyMissing = sys && !sys.googleConfigured;

  return (
    <>
      <div className="bg-scanner relative overflow-hidden rounded-3xl p-6 text-primary-foreground shadow-[var(--shadow-lift)] sm:p-12">
        <div className="grid-lines absolute inset-0" />
        <div className="relative mx-auto max-w-3xl">
          <div className="text-xs font-bold uppercase tracking-[0.25em] opacity-70">Google Review Scanner</div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Paste a Google Maps business URL</h1>
          <p className="mt-2 opacity-75">Scan publicly available Google business and review information.</p>

          {keyMissing && (
            <div className="mt-6 flex items-start gap-3 rounded-xl bg-card/10 p-4 text-sm ring-1 ring-primary-foreground/20">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-star" />
              <div><b>API key required.</b> Live scanning activates automatically once the Google Places API key is added. Demo reports (clearly labelled) are available in <Link to="/reports" className="underline">Reports</Link>.</div>
            </div>
          )}

          <form onSubmit={start} className="mt-6 flex flex-col gap-3 rounded-2xl bg-card p-2 shadow-[var(--shadow-glow)] sm:flex-row">
            <div className="flex flex-1 items-center gap-3 px-3">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input value={url} onChange={(e) => setUrl(e.target.value)} required disabled={running}
                placeholder="https://maps.app.goo.gl/… or google.com/maps/place/…"
                className="h-12 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground" />
            </div>
            <Button type="submit" size="lg" className="h-12 px-8" disabled={running || !!keyMissing}>
              {running ? <Loader2 className="animate-spin" /> : null} Scan reviews
            </Button>
          </form>

          {(running || scanId) && (
            <ol className="mt-8 grid gap-2 sm:grid-cols-5">
              {STEPS.map((s, i) => {
                const done = i < step, active = i === step && running;
                return (
                  <li key={s} className={`relative overflow-hidden rounded-xl p-3 text-xs transition-all duration-500 ${done ? "bg-card/20" : active ? "bg-card/15 ring-1 ring-brand" : "bg-card/5 opacity-50"}`}>
                    {active && <div className="animate-sweep absolute inset-0 bg-gradient-to-r from-transparent via-primary-foreground/10 to-transparent" />}
                    <div className="relative flex items-center gap-2 font-mono opacity-70">
                      {done ? <Check className="h-3.5 w-3.5 text-risk-normal" /> : active ? <span className="animate-pulse-ring h-2 w-2 rounded-full bg-brand" /> : null}
                      0{i + 1}
                    </div>
                    <div className="relative mt-1 font-medium">{s}{active ? "…" : ""}</div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      {error && (
        <div className="surface animate-rise mt-6 flex items-start gap-3 border-risk-high/30 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-risk-high" />
          <div>
            <div className="font-semibold">{errorTitle(error.code)}</div>
            <div className="mt-1 text-sm text-muted-foreground">{error.message}</div>
          </div>
        </div>
      )}

      {scanId && <ScanResult id={scanId} />}
    </>
  );
}

function errorTitle(code: string) {
  return ({
    INVALID_URL: "Invalid Google URL", NOT_FOUND: "Business not found", API_UNAVAILABLE: "API unavailable",
    API_KEY_REQUIRED: "API key required", RATE_LIMIT: "Rate limit reached", INSUFFICIENT_DATA: "Insufficient data",
    GOOGLE_ERROR: "Temporary Google service error", NETWORK: "Network error",
  } as Record<string, string>)[code] ?? "Scan failed";
}

function ScanResult({ id }: { id: string }) {
  const { data } = useQuery(scanQuery(id));
  if (!data?.scan) return null;
  return (
    <div className="mt-8">
      <BusinessHeader scan={data.scan} />
      <RiskAnalysis scan={data.scan} reviews={data.reviews} />
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSystemStatus } from "@/lib/scan.functions";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — SEO Vale" }, { name: "description", content: "Account, API and security settings." }] }),
  component: SettingsPage,
});

function Dot({ ok, label }: { ok: boolean | undefined; label: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? "bg-risk-normal-soft text-risk-normal" : ok === false ? "bg-risk-medium-soft text-risk-medium" : "bg-muted text-muted-foreground"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-risk-normal" : ok === false ? "bg-risk-medium" : "bg-muted-foreground"}`} />{label}
    </span>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="surface p-6"><h2 className="mb-5 font-semibold">{title}</h2><div className="space-y-4">{children}</div></section>;
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">{k}</span><span>{v}</span></div>;
}

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const status = useServerFn(getSystemStatus);
  const { data: sys, isLoading } = useQuery({ queryKey: ["system-status"], queryFn: () => status() });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [cur, setCur] = useState(""); const [pw, setPw] = useState("");
  const [name, setName] = useState<string>((user.user_metadata?.["name"] as string) ?? "");

  async function saveName() {
    const { error } = await supabase.auth.updateUser({ data: { name } });
    error ? toast.error(error.message) : toast.success("Name saved");
  }
  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw, current_password: cur } as any);
    if (error) toast.error(error.message); else { toast.success("Password updated"); setCur(""); setPw(""); }
  }
  async function logoutAll() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut({ scope: "global" });
    navigate({ to: "/auth", replace: true });
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Account, integrations and security." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account">
          <div className="flex gap-2"><div className="flex-1 space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div><Button className="self-end" variant="outline" onClick={saveName}>Save</Button></div>
          <Row k="Email" v={user.email} />
          <form onSubmit={changePw} className="space-y-3 border-t pt-4">
            <Label>Change password</Label>
            <Input type="password" placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} required />
            <Input type="password" placeholder="New password (min 8)" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required />
            <Button type="submit" size="sm">Update password</Button>
          </form>
        </Card>
        <Card title="Google API">
          <Row k="Connection status" v={isLoading ? <Dot ok={undefined} label="Checking…" /> : <Dot ok={sys?.googleConfigured} label={sys?.googleConfigured ? "Connected" : "API key required"} />} />
          <Row k="API" v="Places API (New) — official" />
          <Row k="Review limit" v={`Up to ${sys?.reviewLimit ?? 5} reviews per business (Google limit)`} />
          <Row k="Secure API configuration" v={<span className="font-mono text-xs">GOOGLE_PLACES_API_KEY · server-side only</span>} />
          {!sys?.googleConfigured && <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Create a key in Google Cloud Console with "Places API (New)" enabled, then ask the assistant to add it securely. Scans activate automatically.</p>}
        </Card>
        <Card title="AI Analysis">
          <Row k="Analysis status" v={<Dot ok={sys?.aiConfigured} label={sys?.aiConfigured ? "Active" : "Unavailable"} />} />
          <Row k="Model" v={<span className="font-mono text-xs">{sys?.aiModel ?? "—"}</span>} />
          <Row k="Preferences" v="Conservative — genuine negative experiences are not flagged" />
        </Card>
        <Card title="Security & System">
          <Row k="Database" v={<Dot ok={sys?.databaseOk} label={sys?.databaseOk ? "Healthy" : "Checking…"} />} />
          <Row k="Current session" v={user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Active"} />
          <Button variant="outline" onClick={logoutAll}>Log out of all sessions</Button>
        </Card>
      </div>
    </>
  );
}

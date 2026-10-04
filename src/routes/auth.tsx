import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Review & Rating Scanner" },
      { name: "description", content: "Admin sign in for the Google Review & Rating Scanner." },
      { property: "og:title", content: "Sign in — Review & Rating Scanner" },
      { property: "og:description", content: "Admin sign in for the Google Review & Rating Scanner." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard" });
        else toast.success("Check your email to confirm your admin account.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="bg-scanner relative hidden overflow-hidden p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="grid-lines absolute inset-0" />
        <div className="relative flex items-center gap-2 font-bold"><Star className="h-5 w-5 text-star" fill="currentColor" strokeWidth={0} /> Review & Rating Scanner</div>
        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">Google review intelligence,<br />without the noise.</h1>
          <p className="mt-4 max-w-md opacity-75">Paste a Maps link. Get rating, review risk classification and an evidence report ready for Google's official reporting path.</p>
        </div>
        <div className="relative text-xs opacity-60">Uses official Google Places data only.</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="surface w-full max-w-sm space-y-5 p-8">
          <div>
            <h2 className="text-2xl font-bold">{mode === "in" ? "Admin sign in" : "Create admin account"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Single administrator access.</p>
          </div>
          <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</Button>
          <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "First time? Create the admin account" : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

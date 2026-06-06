import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Particles } from "@/components/Particles";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Admin Login — Cubyn Spigot" }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/admin" } });
        if (error) throw error;
        toast.success("Account created. Signing you in…");
        const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signErr) throw signErr;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      toast.success("Welcome back");
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <Particles count={30} />
      <div className="absolute inset-x-0 top-0 mx-auto h-[400px] max-w-2xl" style={{ background: "var(--gradient-glow)" }} aria-hidden />
      <div className="glass-strong relative w-full max-w-md rounded-3xl p-8 animate-fade-up">
        <Link to="/" className="flex justify-center"><Logo size={40} /></Link>
        <h1 className="mt-6 text-center font-display text-2xl font-bold">{mode === "signin" ? "Admin Sign In" : "Create Admin Account"}</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">Authorized personnel only</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-lg bg-input/60 px-3 py-2.5 text-sm text-foreground outline-none ring-1 ring-border/60 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Password</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg bg-input/60 px-3 py-2.5 text-sm text-foreground outline-none ring-1 ring-border/60 focus:ring-primary" />
          </div>
          <button type="submit" disabled={busy} className="btn-glow hover:btn-glow-hover w-full rounded-lg px-4 py-2.5 text-sm disabled:opacity-60">
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-primary">
          {mode === "signin" ? "First admin? Create an account →" : "← Back to sign in"}
        </button>
        <Link to="/" className="mt-6 block text-center text-xs text-muted-foreground hover:text-primary">← Back to site</Link>
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Lock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Particles } from "@/components/Particles";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Cubyn Spigot" }, { name: "robots", content: "noindex" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [hasRecovery, setHasRecovery] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase places recovery token in URL hash; the SDK auto-exchanges into a session.
    supabase.auth.getSession().then(({ data }) => setHasRecovery(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setHasRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const pwd = z.string().min(8, { message: "At least 8 characters" }).max(72).parse(password);
      if (pwd !== confirm) throw new Error("Passwords don't match");
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      setDone(true);
      toast.success("Password updated");
      setTimeout(() => navigate({ to: "/account" }), 1200);
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Failed";
      toast.error(msg);
    } finally { setBusy(false); }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <Particles count={20} />
      <div className="glass-strong relative w-full max-w-md rounded-3xl p-8 animate-fade-up">
        <div className="flex justify-center"><Logo size={36} /></div>
        {done ? (
          <div className="mt-8 text-center">
            <CheckCircle2 size={48} className="mx-auto text-primary" />
            <h2 className="mt-4 font-display text-xl font-bold">Password updated</h2>
            <p className="mt-2 text-sm text-muted-foreground">Redirecting…</p>
          </div>
        ) : hasRecovery === null ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : !hasRecovery ? (
          <div className="mt-6 text-center">
            <h2 className="font-display text-xl font-bold">Invalid or expired link</h2>
            <p className="mt-2 text-sm text-muted-foreground">Your reset link is no longer valid. Request a new one.</p>
            <Link to="/auth" search={{ tab: "forgot" }} className="btn-glow hover:btn-glow-hover mt-6 inline-block rounded-lg px-4 py-2.5 text-sm">Request new link</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <h1 className="font-display text-2xl font-bold">Set a new password</h1>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">New password</label>
              <div className="relative mt-1.5">
                <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="password" required minLength={8} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg bg-input/60 py-2.5 pl-9 pr-3 text-sm text-foreground outline-none ring-1 ring-border/60 focus:ring-primary" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Confirm password</label>
              <div className="relative mt-1.5">
                <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="password" required minLength={8} maxLength={72} value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-lg bg-input/60 py-2.5 pl-9 pr-3 text-sm text-foreground outline-none ring-1 ring-border/60 focus:ring-primary" />
              </div>
            </div>
            <button type="submit" disabled={busy} className="btn-glow hover:btn-glow-hover w-full rounded-lg px-4 py-2.5 text-sm disabled:opacity-60">
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

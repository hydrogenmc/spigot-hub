import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Mail, Lock, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Particles } from "@/components/Particles";

const searchSchema = z.object({
  tab: z.enum(["signin", "signup", "forgot"]).default("signin").catch("signin"),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Sign in — Cubyn Spigot" }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

const emailSchema = z.string().trim().toLowerCase().email({ message: "Enter a valid email" }).max(255);
const passwordSchema = z.string().min(8, { message: "At least 8 characters" }).max(72);

function AuthPage() {
  const navigate = useNavigate();
  const { tab, redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [signedUp, setSignedUp] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirect ?? "/account" });
    });
  }, [navigate, redirect]);

  const setTab = (t: "signin" | "signup" | "forgot") =>
    navigate({ to: "/auth", search: { tab: t, redirect } });

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const parsedEmail = emailSchema.parse(email);
      const parsedPwd = z.string().min(1).parse(password);
      const { error } = await supabase.auth.signInWithPassword({ email: parsedEmail, password: parsedPwd });
      if (error) throw error;
      toast.success("Welcome back!");
      navigate({ to: redirect ?? "/account" });
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Sign in failed";
      toast.error(msg);
    } finally { setBusy(false); }
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const parsedEmail = emailSchema.parse(email);
      const parsedPwd = passwordSchema.parse(password);
      const name = z.string().trim().min(2).max(60).parse(displayName);
      const { error } = await supabase.auth.signUp({
        email: parsedEmail, password: parsedPwd,
        options: { emailRedirectTo: `${window.location.origin}/auth`, data: { name } },
      });
      if (error) throw error;
      setSignedUp(true);
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Sign up failed";
      toast.error(msg);
    } finally { setBusy(false); }
  };

  const forgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const parsedEmail = emailSchema.parse(email);
      const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Check your inbox for a reset link.");
      setTab("signin");
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Request failed";
      toast.error(msg);
    } finally { setBusy(false); }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <Particles count={30} />
      <div className="absolute inset-x-0 top-0 mx-auto h-[400px] max-w-2xl" style={{ background: "var(--gradient-glow)" }} aria-hidden />

      <div className="glass-strong relative w-full max-w-md rounded-3xl p-8 animate-fade-up">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><ArrowLeft size={12} /> Back to site</Link>
        <div className="mt-4 flex justify-center"><Logo size={36} /></div>

        {signedUp ? (
          <div className="mt-8 text-center">
            <CheckCircle2 size={48} className="mx-auto text-primary" />
            <h2 className="mt-4 font-display text-2xl font-bold">Check your inbox</h2>
            <p className="mt-2 text-sm text-muted-foreground">We sent a verification link to <span className="text-foreground">{email}</span>. Click it to activate your account, then sign in.</p>
            <button onClick={() => { setSignedUp(false); setTab("signin"); }} className="btn-glow hover:btn-glow-hover mt-6 w-full rounded-lg px-4 py-2.5 text-sm">Back to sign in</button>
            <p className="mt-3 text-xs text-muted-foreground">Didn't get the email? Check spam, or try signing up again.</p>
          </div>
        ) : (
          <>
            <h1 className="mt-6 text-center font-display text-2xl font-bold">
              {tab === "signin" && "Welcome back"}
              {tab === "signup" && "Create your account"}
              {tab === "forgot" && "Reset your password"}
            </h1>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              {tab === "signin" && "Sign in to download resources and earn credits"}
              {tab === "signup" && "Get 20 free credits when you join"}
              {tab === "forgot" && "We'll email you a secure reset link"}
            </p>

            {tab !== "forgot" && (
              <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-input/40 p-1">
                <button onClick={() => setTab("signin")} className={`rounded-lg py-2 text-sm transition ${tab === "signin" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>Sign in</button>
                <button onClick={() => setTab("signup")} className={`rounded-lg py-2 text-sm transition ${tab === "signup" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>Sign up</button>
              </div>
            )}

            {tab === "signin" && (
              <form onSubmit={signIn} className="mt-6 space-y-4">
                <EmailField value={email} onChange={setEmail} />
                <PasswordField value={password} onChange={setPassword} />
                <div className="flex items-center justify-between text-xs">
                  <label className="inline-flex items-center gap-2 text-muted-foreground">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
                  </label>
                  <button type="button" onClick={() => setTab("forgot")} className="text-primary hover:underline">Forgot password?</button>
                </div>
                <button type="submit" disabled={busy} className="btn-glow hover:btn-glow-hover w-full rounded-lg px-4 py-2.5 text-sm disabled:opacity-60">
                  {busy ? "Signing in…" : "Sign in"}
                </button>
              </form>
            )}

            {tab === "signup" && (
              <form onSubmit={signUp} className="mt-6 space-y-4">
                <Field label="Display name">
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required minLength={2} maxLength={60} placeholder="Steve" className={inp} />
                </Field>
                <EmailField value={email} onChange={setEmail} />
                <PasswordField value={password} onChange={setPassword} hint="Min 8 chars. Checked against known breaches." />
                <p className="px-2 pt-1 text-center text-xs leading-relaxed text-muted-foreground">By signing up you agree to our <Link to="/terms" className="text-primary hover:underline">Terms</Link> and <Link to="/privacy" className="text-primary hover:underline">Privacy</Link>.</p>
                <button type="submit" disabled={busy} className="btn-glow hover:btn-glow-hover w-full rounded-lg px-4 py-2.5 text-sm disabled:opacity-60">
                  {busy ? "Creating account…" : "Create account"}
                </button>
              </form>
            )}

            {tab === "forgot" && (
              <form onSubmit={forgot} className="mt-6 space-y-4">
                <EmailField value={email} onChange={setEmail} />
                <button type="submit" disabled={busy} className="btn-glow hover:btn-glow-hover w-full rounded-lg px-4 py-2.5 text-sm disabled:opacity-60">
                  {busy ? "Sending…" : "Send reset link"}
                </button>
                <button type="button" onClick={() => setTab("signin")} className="w-full text-center text-xs text-muted-foreground hover:text-primary">← Back to sign in</button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const inp = "w-full rounded-lg bg-input/60 px-3 py-2.5 text-sm text-foreground outline-none ring-1 ring-border/60 transition focus:ring-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function EmailField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Email">
      <div className="relative">
        <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="email" required value={value} onChange={(e) => onChange(e.target.value)} className={`${inp} pl-9`} placeholder="you@example.com" autoComplete="email" />
      </div>
    </Field>
  );
}

function PasswordField({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <Field label="Password">
      <div className="relative">
        <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="password" required minLength={8} maxLength={72} value={value} onChange={(e) => onChange(e.target.value)} className={`${inp} pl-9`} placeholder="••••••••" autoComplete="current-password" />
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Field>
  );
}

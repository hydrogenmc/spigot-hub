import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Coins, Crown, Calendar, Gift, Save, LogOut, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getMe, claimDailyCredits, updateProfile } from "@/lib/auth.functions";
import { getMyLedger } from "@/lib/credits.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "My Account — Cubyn Spigot" }, { name: "robots", content: "noindex" }] }),
  component: AccountPage,
});

function AccountPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useServerFn(getMe);
  const claim = useServerFn(claimDailyCredits);
  const update = useServerFn(updateProfile);
  const ledger = useServerFn(getMyLedger);

  const meQ = useQuery({ queryKey: ["me"], queryFn: () => me() });
  const ledQ = useQuery({ queryKey: ["my-ledger"], queryFn: () => ledger() });

  const [name, setName] = useState("");

  const claimMut = useMutation({
    mutationFn: () => claim(),
    onSuccess: (r) => {
      if (r.ok) toast.success(`+${r.awarded} credits!`);
      else if (r.reason === "already_claimed") toast.info("Already claimed today.");
      else toast.error("Daily credits disabled");
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["my-ledger"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const updateMut = useMutation({
    mutationFn: () => update({ data: { display_name: name } }),
    onSuccess: () => { toast.success("Profile updated"); qc.invalidateQueries({ queryKey: ["me"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/" });
  };

  const data = meQ.data;
  const balance = data?.profile?.credits_balance ?? 0;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold">My <span className="text-gradient">Account</span></h1>
          <button onClick={signOut} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary">
            <LogOut size={14} /> Sign out
          </button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <Card icon={Coins} label="Credits balance" value={balance.toLocaleString()}
            footer={<button onClick={() => claimMut.mutate()} disabled={claimMut.isPending}
              className="text-xs text-primary hover:underline disabled:opacity-50">
              <Gift size={12} className="mr-1 inline" /> Claim daily credits
            </button>} />
          <Card icon={Crown} label="Membership" value={data?.isVip ? "VIP" : "Member"}
            footer={data?.isVip ? (
              <span className="text-xs text-muted-foreground">{data.vipExpiresAt ? `Expires ${new Date(data.vipExpiresAt).toLocaleDateString()}` : "Lifetime"}</span>
            ) : (
              <Link to="/membership" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Upgrade to VIP <ArrowRight size={10} /></Link>
            )} />
          <Card icon={Calendar} label="Downloads today" value={String(data?.downloadsToday ?? 0)}
            footer={<Link to="/resources" className="text-xs text-primary hover:underline">Browse resources →</Link>} />
        </div>

        <section className="glass-strong mt-6 rounded-2xl p-6">
          <div className="flex items-center gap-2">
            <Crown size={18} className="text-amber-400" />
            <h2 className="font-display text-lg font-semibold">{data?.isVip ? "Your VIP Benefits" : "VIP Benefits"}</h2>
            {data?.isVip && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">ACTIVE</span>}
          </div>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {[
              "Access to all VIP-only resources",
              "Higher (or unlimited) daily download limit",
              "No credit cost on Paid resources",
              "Priority support & early access",
            ].map((b) => (
              <li key={b} className="flex items-start gap-2 text-muted-foreground">
                <Gift size={14} className="mt-0.5 text-primary" /> <span>{b}</span>
              </li>
            ))}
          </ul>
          {data?.isVip ? (
            <p className="mt-4 text-xs text-muted-foreground">
              {data.vipExpiresAt ? `Membership active until ${new Date(data.vipExpiresAt).toLocaleDateString()}.` : "Lifetime membership — thanks for your support!"}
            </p>
          ) : (
            <Link to="/membership" className="btn-glow hover:btn-glow-hover mt-5 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm">
              <Crown size={14} /> Upgrade to VIP
            </Link>
          )}
        </section>

        <section className="glass-strong mt-8 rounded-2xl p-6">
          <h2 className="font-display text-lg font-semibold">Profile</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</label>
              <input value={data?.email ?? ""} readOnly className="mt-1.5 w-full rounded-lg bg-input/40 px-3 py-2.5 text-sm text-muted-foreground" />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Display name</label>
              <input value={name || data?.profile?.display_name || ""} onChange={(e) => setName(e.target.value)} maxLength={60}
                className="mt-1.5 w-full rounded-lg bg-input/60 px-3 py-2.5 text-sm text-foreground outline-none ring-1 ring-border/60 focus:ring-primary" />
            </div>
          </div>
          <button onClick={() => updateMut.mutate()} disabled={!name || updateMut.isPending}
            className="btn-glow hover:btn-glow-hover mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm disabled:opacity-60">
            <Save size={14} /> {updateMut.isPending ? "Saving…" : "Save changes"}
          </button>
        </section>

        <section className="glass mt-6 overflow-hidden rounded-2xl">
          <div className="px-6 py-4">
            <h2 className="font-display text-lg font-semibold">Credit history</h2>
          </div>
          {(ledQ.data?.length ?? 0) === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No activity yet.</div>
          ) : (
            <ul className="divide-y divide-border/40">
              {(ledQ.data ?? []).map((r) => (
                <li key={r.id} className="flex items-center justify-between px-6 py-3 text-sm">
                  <div>
                    <div className="font-medium text-foreground capitalize">{r.reason.replace(/_/g, " ")}</div>
                    <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                  </div>
                  <span className={`font-semibold ${r.delta > 0 ? "text-primary" : "text-destructive"}`}>
                    {r.delta > 0 ? "+" : ""}{r.delta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Card({ icon: Icon, label, value, footer }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string; footer?: React.ReactNode }) {
  return (
    <div className="glass-strong rounded-2xl p-6">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon size={14} className="text-primary" /> {label}
      </div>
      <div className="mt-2 font-display text-3xl font-bold text-foreground">{value}</div>
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}

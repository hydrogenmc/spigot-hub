import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Check, Crown, Upload, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Particles } from "@/components/Particles";
import { listPlans } from "@/lib/plans.functions";
import { getSettings } from "@/lib/resources.functions";
import { submitReceipt, getMyReceipts } from "@/lib/receipts.functions";
import { supabase } from "@/integrations/supabase/client";

const planQuery = queryOptions({
  queryKey: ["plans-public"],
  queryFn: async () => {
    const [plans, settings] = await Promise.all([listPlans(), getSettings()]);
    return { plans, settings: settings as Record<string, unknown> };
  },
});

export const Route = createFileRoute("/membership")({
  head: () => ({ meta: [
    { title: "VIP Membership — Cubyn Spigot" },
    { name: "description", content: "Upgrade to VIP for unlimited downloads, exclusive resources, and priority access." },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(planQuery),
  component: MembershipPage,
  errorComponent: ({ error }) => <div className="p-8 text-center text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-center">Not found</div>,
});

function MembershipPage() {
  const { data } = useQuery(planQuery);
  const plans = data?.plans ?? [];
  const payment = ((data?.settings?.payment as Record<string, string> | undefined) ?? {}) as { gcash_number?: string; gcash_name?: string; maya_number?: string; maya_name?: string; instructions?: string };
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <div className="relative min-h-screen">
      <Particles count={30} />
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <Crown size={40} className="mx-auto text-primary" />
          <h1 className="mt-4 font-display text-4xl font-bold">Become a <span className="text-gradient">VIP Member</span></h1>
          <p className="mt-3 text-sm text-muted-foreground">Unlock unlimited downloads, exclusive VIP resources and priority support.</p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.length === 0 && <p className="col-span-full text-center text-muted-foreground">No plans available yet.</p>}
          {plans.map((p, i) => (
            <div key={p.id} className={`glass-strong rounded-2xl p-6 ${i === 1 ? "ring-2 ring-primary" : ""}`}>
              <h3 className="font-display text-xl font-bold text-foreground">{p.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">₱{p.price_php.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">
                  / {p.duration_days ? `${p.duration_days} days` : "lifetime"}
                </span>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Check size={14} className="text-primary" /> All VIP resources</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-primary" /> Unlimited daily downloads</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-primary" /> Priority support</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-primary" /> VIP badge on leaderboard</li>
              </ul>
            </div>
          ))}
        </div>

        <section className="glass-strong mt-12 rounded-2xl p-6">
          <h2 className="font-display text-xl font-bold">How to pay</h2>
          <p className="mt-1 text-sm text-muted-foreground">Send payment via GCash or Maya, then upload your receipt. Our system auto-verifies most receipts in seconds.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <PayBox brand="GCash" name={payment.gcash_name} number={payment.gcash_number} />
            <PayBox brand="Maya" name={payment.maya_name} number={payment.maya_number} />
          </div>
          {payment.instructions && <p className="mt-4 rounded-lg bg-input/40 p-3 text-xs text-muted-foreground whitespace-pre-wrap">{payment.instructions}</p>}
        </section>

        {signedIn === false && (
          <div className="glass-strong mt-6 rounded-2xl p-6 text-center">
            <p className="text-sm text-muted-foreground">You need an account to submit a receipt.</p>
            <Link to="/auth" search={{ tab: "signup", redirect: "/membership" }} className="btn-glow hover:btn-glow-hover mt-4 inline-block rounded-lg px-4 py-2 text-sm">Sign up to continue</Link>
          </div>
        )}

        {signedIn === true && plans.length > 0 && <ReceiptForm plans={plans} />}

        {signedIn === true && <MyReceipts />}
      </main>
      <SiteFooter />
    </div>
  );
}

function PayBox({ brand, name, number }: { brand: string; name?: string; number?: string }) {
  return (
    <div className="rounded-xl border border-border bg-input/30 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-primary">{brand}</div>
      {number ? (
        <>
          <div className="mt-1 font-mono text-lg text-foreground">{number}</div>
          {name && <div className="text-xs text-muted-foreground">{name}</div>}
        </>
      ) : (
        <div className="mt-1 text-sm text-muted-foreground">Not configured yet</div>
      )}
    </div>
  );
}

function ReceiptForm({ plans }: { plans: Array<{ id: string; name: string; price_php: number }> }) {
  const submit = useServerFn(submitReceipt);
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [method, setMethod] = useState<"gcash" | "maya">("gcash");
  const [preview, setPreview] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (vars: { plan_id: string; method: "gcash" | "maya"; image_data_url: string }) =>
      submit({ data: vars }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.reason === "duplicate_image" ? "This receipt was already submitted." : "Receipt rejected.");
        return;
      }
      if (r.status === "auto_approved") toast.success(`Payment verified! VIP activated. (Confidence ${(r.confidence * 100).toFixed(0)}%)`);
      else toast.info("Receipt received — pending manual review.");
      setPreview(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
  });

  const onFile = (f: File) => {
    if (f.size > 5 * 1024 * 1024) return toast.error("Image too large (max 5 MB)");
    const r = new FileReader();
    r.onload = () => setPreview(String(r.result));
    r.readAsDataURL(f);
  };

  return (
    <section className="glass-strong mt-6 rounded-2xl p-6">
      <h2 className="font-display text-xl font-bold">Upload your receipt</h2>
      <p className="mt-1 text-sm text-muted-foreground">PNG, JPG or WebP. Max 5 MB. We extract the amount, reference number and date automatically.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Plan</label>
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="mt-1.5 w-full rounded-lg bg-input/60 px-3 py-2.5 text-sm text-foreground outline-none ring-1 ring-border/60 focus:ring-primary">
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — ₱{p.price_php.toLocaleString()}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Method</label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(["gcash", "maya"] as const).map((m) => (
              <button key={m} onClick={() => setMethod(m)} className={`rounded-lg py-2.5 text-sm transition ${method === m ? "bg-primary/20 text-primary ring-1 ring-primary" : "bg-input/60 text-muted-foreground hover:text-foreground"}`}>
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 bg-input/30 p-8 transition hover:border-primary/60">
        {preview ? (
          <img src={preview} alt="Receipt preview" className="max-h-64 rounded-lg" />
        ) : (
          <>
            <Upload size={28} className="text-primary" />
            <p className="mt-2 text-sm text-foreground">Click to upload receipt screenshot</p>
            <p className="text-xs text-muted-foreground">PNG / JPG / WebP up to 5 MB</p>
          </>
        )}
        <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>

      <button onClick={() => preview && mut.mutate({ plan_id: planId, method, image_data_url: preview })}
        disabled={!preview || mut.isPending}
        className="btn-glow hover:btn-glow-hover mt-4 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm disabled:opacity-60">
        {mut.isPending && <Loader2 size={14} className="animate-spin" />}
        {mut.isPending ? "Verifying receipt…" : "Submit receipt"}
      </button>
    </section>
  );
}

function MyReceipts() {
  const list = useServerFn(getMyReceipts);
  const q = useQuery({ queryKey: ["my-receipts"], queryFn: () => list() });
  if (!q.data || q.data.length === 0) return null;
  return (
    <section className="glass mt-6 overflow-hidden rounded-2xl">
      <div className="px-6 py-4">
        <h3 className="font-display text-lg font-semibold">My receipts</h3>
      </div>
      <ul className="divide-y divide-border/40">
        {q.data.map((r) => (
          <li key={r.id} className="flex items-center justify-between px-6 py-3 text-sm">
            <div>
              <div className="font-medium text-foreground">{r.method.toUpperCase()} · ₱{r.ocr_amount_php ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()} · Ref {r.ocr_reference ?? "—"}</div>
              {r.admin_notes && <div className="mt-1 text-xs text-muted-foreground">Note: {r.admin_notes}</div>}
            </div>
            <StatusPill status={r.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    auto_approved: "bg-primary/20 text-primary",
    approved: "bg-primary/20 text-primary",
    flagged: "bg-yellow-500/20 text-yellow-400",
    pending: "bg-secondary text-muted-foreground",
    rejected: "bg-destructive/20 text-destructive",
  };
  const label = status.replace("_", " ");
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold uppercase ${map[status] ?? "bg-secondary text-muted-foreground"}`}>
      {status === "flagged" && <AlertTriangle size={10} />}
      {label}
    </span>
  );
}

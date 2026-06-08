import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { Download, ArrowLeft, Calendar, User, Tag, Box, Check, Loader2, Lock, Coins, Crown } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { sanitizeHtml } from "@/components/RichTextEditor";
import { getResource, getSettings, getDownloadUrl } from "@/lib/resources.functions";
import { supabase } from "@/integrations/supabase/client";
import type { SiteSettings } from "@/lib/site-settings";

const resourceQuery = (slug: string) =>
  queryOptions({
    queryKey: ["resource", slug],
    queryFn: async () => {
      const [r, s] = await Promise.all([getResource({ data: { slug } }), getSettings()]);
      if (!r) throw notFound();
      return { resource: r as Record<string, unknown> & { id: string; slug: string; title: string; description: string; long_description?: string; changelog?: string; version: string; mc_version: string; author: string; tags: string[]; thumbnail_url: string | null; access_tier: string; credit_cost: number; download_count: number; created_at: string; categories?: { name?: string } | null; resource_screenshots: Array<{ url: string; sort_order: number }>; has_file: boolean }, settings: s as SiteSettings };
    },
  });

export const Route = createFileRoute("/resources/$slug")({
  head: ({ loaderData }) => {
    const r = (loaderData as { resource?: { title?: string; description?: string; thumbnail_url?: string | null } } | undefined)?.resource;
    return {
      meta: [
        { title: `${r?.title ?? "Resource"} — Cubyn Spigot` },
        { name: "description", content: r?.description ?? "Minecraft resource" },
        { property: "og:title", content: r?.title ?? "Resource" },
        { property: "og:description", content: r?.description ?? "" },
        ...(r?.thumbnail_url ? [{ property: "og:image", content: r.thumbnail_url }] : []),
      ],
    };
  },
  loader: ({ params, context }) => context.queryClient.ensureQueryData(resourceQuery(params.slug)),
  component: ResourceDetail,
  notFoundComponent: () => (
    <div className="min-h-screen"><SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-display text-4xl font-bold">Resource not found</h1>
        <Link to="/resources" className="btn-glow mt-6 inline-flex rounded-lg px-4 py-2 text-sm">Browse resources</Link>
      </div>
    </div>
  ),
});

const reasonLabel: Record<string, string> = {
  not_found: "Resource not available",
  vip_required: "VIP membership required",
  insufficient_credits: "Not enough Credits",
  limit_reached: "Daily download limit reached",
  no_file: "No file attached yet",
  denied: "Download not permitted",
};

function ResourceDetail() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(resourceQuery(slug));
  const r = data.resource;
  const getUrl = useServerFn(getDownloadUrl);
  const [dlState, setDlState] = useState<"idle" | "loading" | "done">("idle");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const tierPill =
    r.access_tier === "vip" ? { icon: Crown, label: "VIP only", cls: "bg-amber-500/15 text-amber-400" } :
    r.access_tier === "credit" ? { icon: Coins, label: `${r.credit_cost} Credits`, cls: "bg-primary/15 text-primary" } :
    { icon: Download, label: "Free", cls: "bg-emerald-500/15 text-emerald-400" };

  const handleDownload = async () => {
    if (!signedIn) { toast.info("Please sign in to download"); return; }
    if (dlState === "loading") return;
    setDlState("loading");
    try {
      const res = await getUrl({ data: { id: r.id } });
      if (!res.ok) {
        toast.error(reasonLabel[res.reason] ?? res.reason);
        setDlState("idle");
        return;
      }
      const filename = `${r.slug}-${r.version ?? ""}`.replace(/[^a-z0-9._-]+/gi, "_");
      try {
        const fres = await fetch(res.url);
        if (!fres.ok) throw new Error("fetch failed");
        const blob = await fres.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      } catch {
        window.open(res.url, "_blank", "noopener");
      }
      toast.success(res.tier === "credit" ? `Downloaded — ${res.cost} Credits deducted` : "Download started");
      setDlState("done");
      setTimeout(() => setDlState("idle"), 1800);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
      setDlState("idle");
    }
  };

  const screenshots = (r.resource_screenshots ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <article className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <Link to="/resources" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft size={14} /> Back to resources
        </Link>

        <div className="glass mt-6 overflow-hidden rounded-3xl">
          <div className="relative aspect-[21/9] bg-gradient-to-br from-secondary to-card">
            {r.thumbnail_url ? (
              <img src={r.thumbnail_url} alt={r.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-primary/30"><Box size={80} strokeWidth={1} /></div>
            )}
            <span className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tierPill.cls}`}>
              <tierPill.icon size={12} /> {tierPill.label}
            </span>
          </div>
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                {r.categories?.name && <span className="text-xs font-semibold uppercase tracking-widest text-primary">{r.categories.name}</span>}
                <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">{r.title}</h1>
                <p className="mt-2 max-w-2xl text-muted-foreground">{r.description}</p>
              </div>
              {signedIn === false ? (
                <Link to="/auth" search={{ redirect: `/resources/${r.slug}` } as never} className="btn-glow hover:btn-glow-hover inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm">
                  <Lock size={16} /> Sign in to download
                </Link>
              ) : (
                <button
                  onClick={handleDownload}
                  disabled={dlState === "loading"}
                  aria-busy={dlState === "loading"}
                  className={`btn-glow hover:btn-glow-hover relative inline-flex items-center gap-2 overflow-hidden rounded-xl px-6 py-3 text-sm transition-transform active:scale-95 disabled:opacity-90 ${dlState === "loading" ? "animate-pulse" : ""}`}
                >
                  {dlState === "loading" ? <><Loader2 size={16} className="animate-spin" /> Preparing…</> :
                   dlState === "done" ? <><Check size={16} /> Downloaded</> :
                   <><Download size={16} /> Download</>}
                </button>
              )}
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: Box, label: "Version", value: r.version },
                { icon: Box, label: "MC Version", value: r.mc_version },
                { icon: User, label: "Author", value: r.author },
                { icon: Download, label: "Downloads", value: (r.download_count ?? 0).toLocaleString() },
              ].map((m) => (
                <div key={m.label} className="rounded-xl bg-secondary/40 p-3">
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><m.icon size={12} />{m.label}</dt>
                  <dd className="mt-1 font-semibold text-foreground">{m.value}</dd>
                </div>
              ))}
            </dl>

            {r.tags?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {r.tags.map((t: string) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary"><Tag size={10} />{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {screenshots.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-2xl font-bold">Screenshots</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {screenshots.map((s) => <img key={s.url} src={s.url} alt="" className="rounded-2xl border border-border/60 object-cover" loading="lazy" />)}
            </div>
          </section>
        )}

        {r.long_description && (
          <section className="mt-10">
            <h2 className="font-display text-2xl font-bold">Description</h2>
            <div className="prose-rt glass mt-4 whitespace-pre-wrap rounded-2xl p-6 text-sm leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_b]:font-semibold [&_b]:text-foreground [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(r.long_description) }} />
          </section>
        )}

        {r.changelog && (
          <section className="mt-10">
            <h2 className="font-display text-2xl font-bold">Changelog</h2>
            <div className="prose-rt glass mt-4 whitespace-pre-wrap rounded-2xl p-6 text-sm leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_b]:font-semibold [&_b]:text-foreground [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(r.changelog) }} />
          </section>
        )}

        <p className="mt-8 flex items-center gap-1.5 text-xs text-muted-foreground" suppressHydrationWarning><Calendar size={12} /> Published {new Date(r.created_at).toLocaleDateString()}</p>
      </article>
      <SiteFooter settings={data.settings} />
    </div>
  );
}

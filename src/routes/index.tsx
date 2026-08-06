import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { ArrowRight, Package, Sparkles, Zap, Shield, RefreshCw, Check, Crown } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ResourceCard } from "@/components/ResourceCard";
import { listResources, listCategories, getStats, getSettings } from "@/lib/resources.functions";
import { listPlans } from "@/lib/plans.functions";
import { defaultSettings, type SiteSettings } from "@/lib/site-settings";

const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: async () => {
    const [featured, latest, categories, stats, settings, plans] = await Promise.all([
      listResources({ data: { featured: true, limit: 6 } }),
      listResources({ data: { sort: "newest", limit: 8 } }),
      listCategories(),
      getStats(),
      getSettings(),
      listPlans().catch(() => []),
    ]);
    return { featured: featured.items, latest: latest.items, categories, stats, settings: settings as SiteSettings, plans };
  },
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CubynDev — Premium Minecraft Resources, Free & Affordable" },
      { name: "description", content: "Free Minecraft plugins, skripts, configs and setups. Affordable VIP membership from ₱99/month." },
      { property: "og:title", content: "CubynDev — Premium Minecraft Resources, Free & Affordable" },
      { property: "og:description", content: "Free Minecraft plugins, skripts, configs and setups. Affordable VIP membership from ₱99/month." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "CubynDev",
          url: "https://cubyn.lovable.app",
          description: "Free Minecraft plugins, skripts, configs and setups. Affordable VIP membership from ₱99/month.",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://cubyn.lovable.app/resources?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }),
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  component: HomePage,
});

function SectionHead({
  eyebrow,
  title,
  desc,
  href,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  href?: boolean;
}) {
  return (
    <div className="mb-10 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
      <div className="min-w-0">
        {eyebrow && <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</span>}
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h2>
        {desc && <p className="mt-2 max-w-xl text-sm text-muted-foreground">{desc}</p>}
      </div>
      {href && (
        <Link to="/resources" className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-primary">
          View all →
        </Link>
      )}
    </div>
  );
}

function HomePage() {
  const { data } = useSuspenseQuery(homeQuery);
  const hero = { ...defaultSettings.hero, ...data.settings.hero };
  const featured = data.featured.length ? data.featured : data.latest.slice(0, 6);
  const price = data.plans[0]?.price_php ?? 99;

  return (
    <div className="relative min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 md:py-40">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Free resources · VIP from ₱{price}/month
          </span>

          <h1 className="mt-8 max-w-3xl font-display text-[2.75rem] font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            <span className="block text-foreground">{hero.title}</span>
            <span className="block text-muted-foreground">{hero.subtitle}</span>
          </h1>

          <p className="mt-7 max-w-xl text-base leading-relaxed text-muted-foreground">{hero.description}</p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              to="/resources"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              {hero.primaryCta} <ArrowRight size={16} />
            </Link>
            <Link
              to="/membership"
              className="inline-flex items-center gap-2 rounded-full border border-border/70 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary/50"
            >
              {hero.secondaryCta}
            </Link>
          </div>

          <div className="mt-16 flex flex-wrap items-center gap-x-10 gap-y-4 text-sm">
            {[
              { label: "Resources", value: data.stats.totalResources.toLocaleString() },
              { label: "Downloads", value: data.stats.totalDownloads.toLocaleString() },
              { label: "Categories", value: String(data.categories.length) },
            ].map((s) => (
              <div key={s.label} className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-foreground">{s.value}</span>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="border-b border-border/60">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Sparkles, title: "Free core library", desc: "The essentials stay free forever — no paywall on the basics." },
            { icon: Zap, title: "Instant downloads", desc: "One click from the resource page. No queues, no waiting rooms." },
            { icon: Shield, title: "Reviewed quality", desc: "Every release is checked by the CubynDev team before it ships." },
            { icon: RefreshCw, title: "Lifetime updates", desc: `New versions land in your account. VIP is just ₱${price}/month.` },
          ].map((f) => (
            <div key={f.title}>
              <f.icon size={20} className="text-primary" strokeWidth={1.6} />
              <h3 className="mt-4 text-sm font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHead eyebrow="Featured" title="Hand-picked resources" desc="A shortlist of what the team recommends right now." href />
        {featured.length === 0 ? (
          <div className="surface-quiet rounded-xl p-12 text-center text-sm text-muted-foreground">
            No resources yet. Sign in to admin and add the first one.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((r) => <ResourceCard key={r.id} r={r} />)}
          </div>
        )}
      </section>

      {/* Categories */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="Browse" title="Explore by category" desc="Plugins, skripts, configs and complete server setups." />
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {data.categories.map((c) => (
              <Link
                key={c.id}
                to="/resources"
                search={{ category: c.slug } as never}
                className="surface-quiet group rounded-xl p-5 transition-colors hover:border-primary/40"
              >
                <Package size={18} className="text-primary" strokeWidth={1.6} />
                <div className="mt-3 font-display text-sm font-semibold text-foreground group-hover:text-primary">{c.name}</div>
                <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{c.description}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Latest */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="Latest" title="Fresh uploads" desc="Everything recently added to the CubynDev catalog." href />
          {data.latest.length === 0 ? (
            <div className="surface-quiet rounded-xl p-12 text-center text-sm text-muted-foreground">Nothing here yet.</div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {data.latest.map((r) => <ResourceCard key={r.id} r={r} />)}
            </div>
          )}
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHead
            eyebrow="Pricing"
            title="Free forever. VIP for less than a coffee."
            desc="Start free and upgrade only when you need the premium releases. Cancel anytime."
          />
          <div className="grid max-w-4xl gap-5 md:grid-cols-2">
            <div className="surface-quiet rounded-xl p-7">
              <h3 className="font-display text-lg font-semibold text-foreground">Free</h3>
              <p className="mt-2 font-display text-4xl font-bold text-foreground">
                ₱0<span className="text-sm font-normal text-muted-foreground"> / forever</span>
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
                {["Full access to the free library", "5 downloads per day", "Community support", "New releases weekly"].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <Check size={14} className="mt-0.5 shrink-0 text-primary" /> {t}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                search={{ tab: "signup" }}
                className="mt-8 inline-flex w-full items-center justify-center rounded-full border border-border/70 px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/50"
              >
                Create free account
              </Link>
            </div>

            <div className="surface rounded-xl border-primary/30 p-7">
              <div className="flex items-center gap-2">
                <Crown size={16} className="text-primary" />
                <h3 className="font-display text-lg font-semibold text-foreground">VIP Membership</h3>
              </div>
              <p className="mt-2 font-display text-4xl font-bold text-foreground">
                ₱{price}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}/ {data.plans[0]?.duration_days ? `${data.plans[0].duration_days} days` : "month"}
                </span>
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
                {["Everything in Free", "Unlimited downloads", "All VIP-only resources", "Early access & priority support"].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <Check size={14} className="mt-0.5 shrink-0 text-primary" /> {t}
                  </li>
                ))}
              </ul>
              <Link
                to="/membership"
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                View plans <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter settings={data.settings} />
    </div>
  );
}

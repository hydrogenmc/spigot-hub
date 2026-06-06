import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { ArrowRight, Download, Package, Sparkles, Zap, Shield, Layers } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Particles } from "@/components/Particles";
import { ResourceCard } from "@/components/ResourceCard";
import { listResources, listCategories, getStats, getSettings } from "@/lib/resources.functions";
import { defaultSettings, type SiteSettings } from "@/lib/site-settings";

const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: async () => {
    const [featured, latest, categories, stats, settings] = await Promise.all([
      listResources({ data: { featured: true, limit: 6 } }),
      listResources({ data: { sort: "newest", limit: 8 } }),
      listCategories(),
      getStats(),
      getSettings(),
    ]);
    return { featured, latest, categories, stats, settings: settings as SiteSettings };
  },
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cubyn Spigot — The Ultimate Minecraft Resource Library" },
      { name: "description", content: "Discover and download free Minecraft plugins, skripts, configs, maps and more. Instant downloads, no account required." },
      { property: "og:title", content: "Cubyn Spigot" },
      { property: "og:description", content: "Free premium Minecraft resources." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  component: HomePage,
});

function HomePage() {
  const { data } = useSuspenseQuery(homeQuery);
  const hero = { ...defaultSettings.hero, ...data.settings.hero };
  const featured = data.featured.length ? data.featured : data.latest.slice(0, 6);

  return (
    <div className="relative min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-20 sm:py-28 md:py-36">
        <Particles count={40} />
        <div className="absolute inset-x-0 top-0 mx-auto h-[500px] max-w-4xl" style={{ background: "var(--gradient-glow)" }} aria-hidden />
        <div className="relative mx-auto max-w-5xl text-center">
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-primary animate-fade-up">
            <Sparkles size={12} /> Free · Instant Downloads · No Account
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <span className="text-foreground">{hero.title}</span>
            <br />
            <span className="text-gradient">{hero.subtitle}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg animate-fade-up" style={{ animationDelay: "0.2s" }}>
            {hero.description}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <Link to="/resources" className="btn-glow hover:btn-glow-hover inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm">
              {hero.primaryCta} <ArrowRight size={16} />
            </Link>
            <Link to="/resources" search={{ sort: "newest" } as never} className="glass inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary/60">
              {hero.secondaryCta}
            </Link>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-3 gap-3 sm:gap-6">
            {[
              { icon: Package, label: "Resources", value: data.stats.totalResources.toLocaleString() },
              { icon: Download, label: "Downloads", value: data.stats.totalDownloads.toLocaleString() },
              { icon: Layers, label: "Categories", value: data.categories.length },
            ].map((s) => (
              <div key={s.label} className="glass rounded-2xl p-4 sm:p-6">
                <s.icon className="mx-auto text-primary" size={20} />
                <div className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">{s.value}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features strip */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Zap, title: "Instant Downloads", desc: "No queues, no waiting. Click and download." },
            { icon: Shield, title: "Curated Quality", desc: "Hand-picked resources from trusted authors." },
            { icon: Sparkles, title: "Always Free", desc: "Zero paywalls, no membership, ever." },
          ].map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><f.icon size={18} /></div>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Featured</span>
            <h2 className="mt-1 font-display text-3xl font-bold text-foreground sm:text-4xl">Hand-picked resources</h2>
          </div>
          <Link to="/resources" className="hidden text-sm font-medium text-primary hover:underline sm:inline">View all →</Link>
        </div>
        {featured.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center text-muted-foreground">No resources yet. Sign in to admin and add the first one.</div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((r) => <ResourceCard key={r.id} r={r} />)}
          </div>
        )}
      </section>

      {/* Categories */}
      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6">
        <div className="mb-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">Browse</span>
          <h2 className="mt-1 font-display text-3xl font-bold text-foreground sm:text-4xl">Explore by category</h2>
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {data.categories.map((c) => (
            <Link key={c.id} to="/resources" search={{ category: c.slug } as never} className="glass group rounded-2xl p-5 transition hover:ring-glow hover:-translate-y-0.5">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary group-hover:bg-primary/25">
                <Package size={18} />
              </div>
              <div className="mt-3 font-display font-semibold text-foreground">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.description}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Latest */}
      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Latest</span>
            <h2 className="mt-1 font-display text-3xl font-bold text-foreground sm:text-4xl">Fresh uploads</h2>
          </div>
          <Link to="/resources" className="hidden text-sm font-medium text-primary hover:underline sm:inline">View all →</Link>
        </div>
        {data.latest.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center text-muted-foreground">Nothing here yet.</div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.latest.map((r) => <ResourceCard key={r.id} r={r} />)}
          </div>
        )}
      </section>

      <SiteFooter settings={data.settings} />
    </div>
  );
}

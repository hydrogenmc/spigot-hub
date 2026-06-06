import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Search } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ResourceCard } from "@/components/ResourceCard";
import { listResources, listCategories, getSettings } from "@/lib/resources.functions";
import type { SiteSettings } from "@/lib/site-settings";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  category: fallback(z.string(), "").default(""),
  mc: fallback(z.string(), "").default(""),
  sort: fallback(z.enum(["newest", "popular", "downloads"]), "newest").default("newest"),
});

const baseQuery = queryOptions({
  queryKey: ["resources-base"],
  queryFn: async () => {
    const [categories, settings] = await Promise.all([listCategories(), getSettings()]);
    return { categories, settings: settings as SiteSettings };
  },
});

export const Route = createFileRoute("/resources")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Resources — Cubyn Spigot" }, { name: "description", content: "Browse all Minecraft resources." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(baseQuery),
  component: ResourcesPage,
});

function ResourcesPage() {
  const { q, category, mc, sort } = Route.useSearch();
  const navigate = Route.useNavigate();
  const base = useSuspenseQuery(baseQuery).data;
  const list = useQuery({
    queryKey: ["resources", q, category, mc, sort],
    queryFn: () => listResources({ data: { q: q || undefined, category: category || undefined, mcVersion: mc || undefined, sort } }),
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl font-bold sm:text-5xl">All <span className="text-gradient">Resources</span></h1>
        <p className="mt-2 text-muted-foreground">Free Minecraft plugins, skripts, configs and more.</p>

        <div className="glass mt-8 rounded-2xl p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                value={q} onChange={(e) => navigate({ search: (p) => ({ ...p, q: e.target.value }) })}
                placeholder="Search resources…"
                className="w-full rounded-lg bg-input/60 py-2.5 pl-10 pr-3 text-sm text-foreground outline-none ring-1 ring-border/60 focus:ring-primary"
              />
            </div>
            <select value={category} onChange={(e) => navigate({ search: (p) => ({ ...p, category: e.target.value }) })}
              className="rounded-lg bg-input/60 px-3 py-2.5 text-sm text-foreground outline-none ring-1 ring-border/60 focus:ring-primary">
              <option value="">All categories</option>
              {base.categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </select>
            <input value={mc} onChange={(e) => navigate({ search: (p) => ({ ...p, mc: e.target.value }) })}
              placeholder="MC version" className="w-full rounded-lg bg-input/60 px-3 py-2.5 text-sm text-foreground outline-none ring-1 ring-border/60 focus:ring-primary md:w-32" />
            <select value={sort} onChange={(e) => navigate({ search: (p) => ({ ...p, sort: e.target.value as "newest" | "popular" | "downloads" }) })}
              className="rounded-lg bg-input/60 px-3 py-2.5 text-sm text-foreground outline-none ring-1 ring-border/60 focus:ring-primary">
              <option value="newest">Newest</option>
              <option value="popular">Popular</option>
              <option value="downloads">Most downloads</option>
            </select>
          </div>
        </div>

        <div className="mt-8">
          {list.isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass h-72 animate-pulse rounded-2xl" />)}
            </div>
          ) : (list.data?.length ?? 0) === 0 ? (
            <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
              No resources match your filters. <Link to="/resources" search={{ q: "", category: "", mc: "", sort: "newest" }} className="text-primary hover:underline">Clear filters</Link>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.data!.map((r) => <ResourceCard key={r.id} r={r} />)}
            </div>
          )}
        </div>
      </section>
      <SiteFooter settings={base.settings} />
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQuery, keepPreviousData } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Search, X, SlidersHorizontal, Crown, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ResourceCard } from "@/components/ResourceCard";
import { listResources, listCategories, listResourceFacets, getSettings } from "@/lib/resources.functions";
import type { SiteSettings } from "@/lib/site-settings";

const PAGE_SIZE = 12;

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  category: fallback(z.string(), "").default(""),
  mc: fallback(z.string(), "").default(""),
  tier: fallback(z.enum(["all", "free", "vip"]), "all").default("all"),
  tags: fallback(z.string(), "").default(""),
  deps: fallback(z.string(), "").default(""),
  sort: fallback(z.enum(["newest", "popular", "downloads"]), "newest").default("newest"),
  page: fallback(z.number().int().min(1), 1).default(1),
});

type S = z.infer<typeof searchSchema>;
const splitCsv = (s: string) => s.split(",").map((v) => v.trim()).filter(Boolean);

const baseQuery = queryOptions({
  queryKey: ["resources-base"],
  queryFn: async () => {
    const [categories, facets, settings] = await Promise.all([listCategories(), listResourceFacets(), getSettings()]);
    return { categories, facets, settings: settings as SiteSettings };
  },
  staleTime: 5 * 60 * 1000,
});

export const Route = createFileRoute("/resources/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Resources — CubynDev" }, { name: "description", content: "Browse free and VIP Minecraft resources — filter by category, version, tags, and dependencies." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(baseQuery),
  component: ResourcesPage,
});

function ResourcesPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const base = useSuspenseQuery(baseQuery).data;
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Local debounced search input
  const [qLocal, setQLocal] = useState(search.q);
  useEffect(() => { setQLocal(search.q); }, [search.q]);
  useEffect(() => {
    if (qLocal === search.q) return;
    const t = setTimeout(() => {
      navigate({ search: (p: S) => ({ ...p, q: qLocal, page: 1 }) });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qLocal]);

  const activeTags = useMemo(() => splitCsv(search.tags), [search.tags]);
  const activeDeps = useMemo(() => splitCsv(search.deps), [search.deps]);

  const list = useQuery({
    queryKey: ["resources", search],
    queryFn: () => listResources({ data: {
      q: search.q || undefined,
      category: search.category || undefined,
      mcVersion: search.mc || undefined,
      tier: search.tier,
      tags: activeTags.length ? activeTags : undefined,
      dependencies: activeDeps.length ? activeDeps : undefined,
      sort: search.sort,
      page: search.page,
      limit: PAGE_SIZE,
    } }),
    placeholderData: keepPreviousData,
  });

  // Any filter change (not just search text) should reset to page 1
  const setFilter = (patch: Partial<S>) =>
    navigate({ search: (p: S) => ({ ...p, ...patch, page: 1 }) });
  const goPage = (page: number) => navigate({ search: (p: S) => ({ ...p, page }) });

  const toggleFrom = (csv: string, value: string) => {
    const arr = splitCsv(csv);
    return (arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]).join(",");
  };
  const activeFilterCount = [search.category, search.mc, search.tier !== "all" ? search.tier : "", search.tags, search.deps].filter(Boolean).length;

  const reset = () => navigate({ search: { q: "", category: "", mc: "", tier: "all", tags: "", deps: "", sort: "newest", page: 1 } });

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">All <span className="text-gradient">Resources</span></h1>
            <p className="mt-2 max-w-xl text-muted-foreground">Browse free plugins, skripts, and configs — or unlock the full VIP library from ₱99/month.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/60 px-2.5 py-1"><Sparkles size={11} className="mr-1 inline" /> {total} matching</span>
          </div>
        </div>

        {/* Search bar */}
        <div className="glass-strong mt-8 rounded-2xl p-3 sm:p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                value={qLocal}
                onChange={(e) => setQLocal(e.target.value)}
                placeholder="Search resources, skripts, plugins…"
                className="w-full rounded-lg bg-input/60 py-3 pl-10 pr-4 text-sm text-foreground outline-none ring-1 ring-border/60 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDrawerOpen(true)}
                className="lg:hidden inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm text-foreground hover:bg-secondary">
                <SlidersHorizontal size={14} /> Filters {activeFilterCount > 0 && <span className="rounded-full bg-primary/20 px-1.5 text-[10px] text-primary">{activeFilterCount}</span>}
              </button>
              <select
                value={search.sort}
                onChange={(e) => setFilter({ sort: e.target.value as S["sort"] })}
                className="rounded-lg bg-input/60 px-3 py-2.5 text-sm text-foreground outline-none ring-1 ring-border/60 focus:ring-primary">
                <option value="newest">Newest</option>
                <option value="popular">Popular</option>
                <option value="downloads">Most downloads</option>
              </select>
            </div>
          </div>

          {/* Active chips */}
          {activeFilterCount > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-3">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Active:</span>
              {search.category && <Chip label={`Category: ${search.category}`} onRemove={() => setFilter({ category: "" })} />}
              {search.mc && <Chip label={`MC: ${search.mc}`} onRemove={() => setFilter({ mc: "" })} />}
              {search.tier !== "all" && <Chip label={search.tier === "vip" ? "VIP only" : "Free only"} onRemove={() => setFilter({ tier: "all" })} />}
              {activeTags.map((t) => <Chip key={"t-" + t} label={`#${t}`} onRemove={() => setFilter({ tags: toggleFrom(search.tags, t) })} />)}
              {activeDeps.map((d) => <Chip key={"d-" + d} label={`↳ ${d}`} onRemove={() => setFilter({ deps: toggleFrom(search.deps, d) })} />)}
              <button onClick={reset} className="ml-auto text-xs text-muted-foreground hover:text-primary">Clear all</button>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block">
            <FiltersPanel search={search} setFilter={setFilter} base={base} activeTags={activeTags} activeDeps={activeDeps} toggleFrom={toggleFrom} />
          </aside>

          {/* Results */}
          <div>
            {list.isLoading ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass h-72 animate-pulse rounded-2xl" />)}
              </div>
            ) : items.length === 0 ? (
              <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
                No resources match your filters.{" "}
                <button onClick={reset} className="text-primary hover:underline">Clear all</button>
                {" · "}
                <Link to="/membership" className="text-primary hover:underline">See VIP</Link>
              </div>
            ) : (
              <>
                <div className={`grid gap-5 sm:grid-cols-2 xl:grid-cols-3 ${list.isFetching ? "opacity-70 transition-opacity" : ""}`}>
                  {items.map((r) => <ResourceCard key={r.id} r={r} />)}
                </div>
                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    <button
                      onClick={() => goPage(Math.max(1, search.page - 1))}
                      disabled={search.page <= 1}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary disabled:opacity-40">
                      <ChevronLeft size={14} /> Prev
                    </button>
                    <span className="px-3 text-sm text-muted-foreground">Page {search.page} of {totalPages}</span>
                    <button
                      onClick={() => goPage(Math.min(totalPages, search.page + 1))}
                      disabled={search.page >= totalPages}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary disabled:opacity-40">
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div className="glass-strong absolute right-0 top-0 h-full w-[85%] max-w-xs overflow-y-auto border-l border-border/60 p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-lg font-semibold">Filters</span>
              <button onClick={() => setDrawerOpen(false)} className="rounded-md p-1 text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <FiltersPanel search={search} setFilter={setFilter} base={base} activeTags={activeTags} activeDeps={activeDeps} toggleFrom={toggleFrom} />
            <div className="sticky bottom-0 mt-4 flex gap-2 border-t border-border/40 bg-background/80 py-3 backdrop-blur">
              <button onClick={reset} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm">Clear</button>
              <button onClick={() => setDrawerOpen(false)} className="btn-glow flex-1 rounded-lg px-3 py-2 text-sm">Show results</button>
            </div>
          </div>
        </div>
      )}

      <SiteFooter settings={base.settings} />
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button onClick={onRemove} className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs text-primary hover:bg-primary/25">
      {label} <X size={11} />
    </button>
  );
}

function FiltersPanel({ search, setFilter, base, activeTags, activeDeps, toggleFrom }: {
  search: S;
  setFilter: (patch: Partial<S>) => void;
  base: { categories: Array<{ id: string; slug: string; name: string }>; facets: { tags: string[]; dependencies: string[]; versions: string[] } };
  activeTags: string[];
  activeDeps: string[];
  toggleFrom: (csv: string, value: string) => string;
}) {
  return (
    <div className="space-y-6">
      <FilterGroup label="Access tier">
        <div className="flex gap-1.5">
          {(["all", "free", "vip"] as const).map((t) => (
            <button key={t} onClick={() => setFilter({ tier: t })}
              className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition ${search.tier === t ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:text-foreground"}`}>
              {t === "vip" && <Crown size={10} className="mr-1 inline" />}{t}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Category">
        <div className="flex flex-wrap gap-1.5">
          <PillBtn active={!search.category} onClick={() => setFilter({ category: "" })}>All</PillBtn>
          {base.categories.map((c) => (
            <PillBtn key={c.id} active={search.category === c.slug} onClick={() => setFilter({ category: c.slug })}>{c.name}</PillBtn>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Minecraft version">
        <div className="flex flex-wrap gap-1.5">
          <PillBtn active={!search.mc} onClick={() => setFilter({ mc: "" })}>Any</PillBtn>
          {base.facets.versions.slice(0, 12).map((v) => (
            <PillBtn key={v} active={search.mc === v} onClick={() => setFilter({ mc: v })}>{v}</PillBtn>
          ))}
        </div>
        <input value={search.mc} onChange={(e) => setFilter({ mc: e.target.value })} placeholder="Custom (e.g. 1.21)"
          className="mt-2 w-full rounded-lg bg-input/60 px-3 py-2 text-xs outline-none ring-1 ring-border/60 focus:ring-primary" />
      </FilterGroup>

      {base.facets.tags.length > 0 && (
        <FilterGroup label={`Tags ${activeTags.length ? `(${activeTags.length})` : ""}`}>
          <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto pr-1">
            {base.facets.tags.map((t) => (
              <PillBtn key={t} active={activeTags.includes(t)} onClick={() => setFilter({ tags: toggleFrom(search.tags, t) })}>#{t}</PillBtn>
            ))}
          </div>
        </FilterGroup>
      )}

      {base.facets.dependencies.length > 0 && (
        <FilterGroup label={`Dependencies ${activeDeps.length ? `(${activeDeps.length})` : ""}`}>
          <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto pr-1">
            {base.facets.dependencies.map((d) => (
              <PillBtn key={d} active={activeDeps.includes(d)} onClick={() => setFilter({ deps: toggleFrom(search.deps, d) })}>{d}</PillBtn>
            ))}
          </div>
        </FilterGroup>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function PillBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs transition ${active ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:text-foreground"}`}>
      {children}
    </button>
  );
}

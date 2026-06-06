import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { listCategories, getSettings } from "@/lib/resources.functions";
import type { SiteSettings } from "@/lib/site-settings";

const q = queryOptions({
  queryKey: ["categories-page"],
  queryFn: async () => {
    const [categories, settings] = await Promise.all([listCategories(), getSettings()]);
    return { categories, settings: settings as SiteSettings };
  },
});

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "Categories — Cubyn Spigot" }, { name: "description", content: "Browse Minecraft resources by category." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { data } = useSuspenseQuery(q);
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl font-bold sm:text-5xl"><span className="text-gradient">Categories</span></h1>
        <p className="mt-2 text-muted-foreground">Find exactly what you need.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.categories.map((c) => (
            <Link key={c.id} to="/resources" search={{ category: c.slug } as never}
              className="glass group rounded-2xl p-6 transition hover:ring-glow hover:-translate-y-0.5">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary group-hover:bg-primary/25"><Package size={22} /></div>
              <h3 className="mt-4 font-display text-xl font-semibold text-foreground">{c.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
            </Link>
          ))}
        </div>
      </section>
      <SiteFooter settings={data.settings} />
    </div>
  );
}

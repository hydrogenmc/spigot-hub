import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getSettings } from "@/lib/resources.functions";
import { defaultSettings, type SiteSettings } from "@/lib/site-settings";

const q = queryOptions({ queryKey: ["settings"], queryFn: async () => (await getSettings()) as SiteSettings });

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About — Cubyn Spigot" }, { name: "description", content: "About Cubyn Spigot" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: AboutPage,
});

function AboutPage() {
  const settings = useSuspenseQuery(q).data;
  const about = { ...defaultSettings.about, ...settings.about };
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h1 className="font-display text-4xl font-bold sm:text-5xl">{about.title}</h1>
        <div className="glass mt-8 whitespace-pre-wrap rounded-2xl p-8 text-base leading-relaxed text-muted-foreground">{about.body}</div>
      </section>
      <SiteFooter settings={settings} />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Mail, MessageCircle, Twitter, Github } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getSettings } from "@/lib/resources.functions";
import { defaultSettings, type SiteSettings } from "@/lib/site-settings";

const q = queryOptions({ queryKey: ["settings"], queryFn: async () => (await getSettings()) as SiteSettings });

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — Cubyn Spigot" }, { name: "description", content: "Get in touch with the Cubyn Spigot team." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: ContactPage,
});

function ContactPage() {
  const settings = useSuspenseQuery(q).data;
  const c = { ...defaultSettings.contact, ...settings.contact };
  const cards = [
    c.email && { icon: Mail, label: "Email", value: c.email, href: `mailto:${c.email}` },
    c.discord && { icon: MessageCircle, label: "Discord", value: "Join the community", href: c.discord },
    c.twitter && { icon: Twitter, label: "Twitter / X", value: c.twitter, href: c.twitter },
    c.github && { icon: Github, label: "GitHub", value: c.github, href: c.github },
  ].filter(Boolean) as { icon: typeof Mail; label: string; value: string; href: string }[];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h1 className="font-display text-4xl font-bold sm:text-5xl">Get in <span className="text-gradient">touch</span></h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Questions, suggestions, or want to contribute a resource? Reach out.</p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {cards.map((card) => (
            <a key={card.label} href={card.href} target="_blank" rel="noreferrer"
              className="glass group flex items-center gap-4 rounded-2xl p-5 text-left transition hover:ring-glow hover:-translate-y-0.5">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary group-hover:bg-primary/25"><card.icon size={20} /></div>
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{card.label}</div>
                <div className="font-semibold text-foreground">{card.value}</div>
              </div>
            </a>
          ))}
        </div>
      </section>
      <SiteFooter settings={settings} />
    </div>
  );
}

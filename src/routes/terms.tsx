import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of Service — Cubyn Spigot" }, { name: "description", content: "Terms of Service" }] }),
  component: () => (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h1 className="font-display text-4xl font-bold sm:text-5xl">Terms of <span className="text-gradient">Service</span></h1>
        <div className="glass mt-8 space-y-4 rounded-2xl p-8 text-sm leading-relaxed text-muted-foreground">
          <p><strong className="text-foreground">1. Acceptance.</strong> By accessing Cubyn Spigot you agree to these terms.</p>
          <p><strong className="text-foreground">2. Free Use.</strong> All resources are provided free of charge for personal and commercial Minecraft server use.</p>
          <p><strong className="text-foreground">3. Attribution.</strong> Original resource authors retain all rights to their work. Cubyn Spigot serves as a distribution platform.</p>
          <p><strong className="text-foreground">4. No Warranty.</strong> Resources are provided "as-is" without warranty of any kind.</p>
          <p><strong className="text-foreground">5. Prohibited Use.</strong> You may not redistribute resources behind paywalls or claim them as your own.</p>
          <p><strong className="text-foreground">6. Changes.</strong> We may update these terms at any time. Continued use constitutes acceptance.</p>
        </div>
      </section>
      <SiteFooter />
    </div>
  ),
});

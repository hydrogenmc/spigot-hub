import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — Cubyn Spigot" }, { name: "description", content: "Privacy Policy" }] }),
  component: () => (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h1 className="font-display text-4xl font-bold sm:text-5xl">Privacy <span className="text-gradient">Policy</span></h1>
        <div className="glass mt-8 space-y-4 rounded-2xl p-8 text-sm leading-relaxed text-muted-foreground">
          <p><strong className="text-foreground">No Tracking.</strong> Cubyn Spigot does not require an account and does not track individual visitors.</p>
          <p><strong className="text-foreground">Download Counts.</strong> We count downloads in aggregate to surface popular resources. No personal data is collected.</p>
          <p><strong className="text-foreground">Admins.</strong> Administrators must authenticate. Their email is stored to manage access.</p>
          <p><strong className="text-foreground">Cookies.</strong> We use only essential cookies needed for the admin session.</p>
        </div>
      </section>
      <SiteFooter />
    </div>
  ),
});

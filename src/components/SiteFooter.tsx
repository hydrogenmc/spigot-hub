import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import type { SiteSettings } from "@/lib/site-settings";

export function SiteFooter({ settings }: { settings?: SiteSettings }) {
  const contact = settings?.contact;
  const tagline = settings?.footer?.tagline ?? "Premium Minecraft resources, free for everyone.";

  return (
    <footer className="mt-24 border-t border-border/50 glass">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">{tagline}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Explore</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/resources" className="text-muted-foreground hover:text-primary">Resources</Link></li>
              <li><Link to="/categories" className="text-muted-foreground hover:text-primary">Categories</Link></li>
              <li><Link to="/about" className="text-muted-foreground hover:text-primary">About</Link></li>
              <li><Link to="/contact" className="text-muted-foreground hover:text-primary">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Legal</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/terms" className="text-muted-foreground hover:text-primary">Terms of Service</Link></li>
              <li><Link to="/privacy" className="text-muted-foreground hover:text-primary">Privacy Policy</Link></li>
              {contact?.discord && (
                <li><a href={contact.discord} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">Discord</a></li>
              )}
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/50 pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© 2026 Cubyn Spigot. All Rights Reserved.</p>
          <p>Built for the Minecraft community.</p>
        </div>
      </div>
    </footer>
  );
}

import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import type { SiteSettings } from "@/lib/site-settings";

export function SiteFooter({ settings }: { settings?: SiteSettings }) {
  const contact = settings?.contact;
  const tagline = settings?.footer?.tagline ?? "Premium Minecraft resources, free for everyone.";

  return (
    <footer className="mt-28 border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">{tagline}</p>
          </div>
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Explore</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link to="/resources" className="text-foreground/80 hover:text-primary">Resources</Link></li>
              <li><Link to="/categories" className="text-foreground/80 hover:text-primary">Categories</Link></li>
              <li><Link to="/membership" className="text-foreground/80 hover:text-primary">Membership</Link></li>
              <li><Link to="/about" className="text-foreground/80 hover:text-primary">About</Link></li>
              <li><Link to="/contact" className="text-foreground/80 hover:text-primary">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Legal</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link to="/terms" className="text-foreground/80 hover:text-primary">Terms of Service</Link></li>
              <li><Link to="/privacy" className="text-foreground/80 hover:text-primary">Privacy Policy</Link></li>
              {contact?.discord && (
                <li><a href={contact.discord} target="_blank" rel="noreferrer" className="text-foreground/80 hover:text-primary">Discord</a></li>
              )}
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© 2026 CubynDev. All Rights Reserved.</p>
          <p>Built for the Minecraft community.</p>
        </div>
      </div>
    </footer>
  );
}

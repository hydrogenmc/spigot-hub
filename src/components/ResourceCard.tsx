import { Link } from "@tanstack/react-router";
import { Download, Package } from "lucide-react";

export interface ResourceCardData {
  slug: string;
  title: string;
  description: string;
  thumbnail_url?: string | null;
  download_count?: number | null;
  version?: string;
  mc_version?: string;
  author?: string;
  featured?: boolean;
  categories?: { name?: string; slug?: string } | null;
}

export function ResourceCard({ r }: { r: ResourceCardData }) {
  return (
    <Link
      to="/resources/$slug"
      params={{ slug: r.slug }}
      className="group glass relative flex flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:ring-glow hover:-translate-y-1"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-secondary to-card">
        {r.thumbnail_url ? (
          <img src={r.thumbnail_url} alt={r.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-primary/40">
            <Package size={48} strokeWidth={1.2} />
          </div>
        )}
        {r.featured && (
          <span className="absolute left-3 top-3 rounded-full bg-primary/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground backdrop-blur">
            Featured
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {r.categories?.name && (
          <span className="text-[11px] font-medium uppercase tracking-wider text-primary/80">{r.categories.name}</span>
        )}
        <h3 className="mt-1 line-clamp-1 font-display text-base font-semibold text-foreground group-hover:text-primary">{r.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description || "No description"}</p>
        <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
          <span>v{r.version} · MC {r.mc_version}</span>
          <span className="inline-flex items-center gap-1">
            <Download size={12} /> {(r.download_count ?? 0).toLocaleString()}
          </span>
        </div>
      </div>
    </Link>
  );
}

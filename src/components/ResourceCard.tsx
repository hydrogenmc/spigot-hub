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
  access_tier?: string;
  categories?: { name?: string; slug?: string } | null;
}

export function ResourceCard({ r }: { r: ResourceCardData }) {
  const isVip = r.access_tier === "vip";
  return (
    <Link
      to="/resources/$slug"
      params={{ slug: r.slug }}
      className="group surface-quiet flex flex-col overflow-hidden rounded-xl transition-colors duration-200 hover:border-primary/40"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-secondary/40">
        {r.thumbnail_url ? (
          <img
            src={r.thumbnail_url}
            alt={r.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/40">
            <Package size={40} strokeWidth={1} />
          </div>
        )}
        {r.featured && (
          <span className="absolute left-3 top-3 rounded-md border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur">
            Featured
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          {r.categories?.name && <span className="truncate">{r.categories.name}</span>}
          {r.categories?.name && <span className="opacity-40">·</span>}
          <span className="inline-flex items-center gap-1">
            <Download size={11} /> {(r.download_count ?? 0).toLocaleString()}
          </span>
        </div>

        <h3 className="mt-2 line-clamp-1 font-display text-base font-semibold text-foreground transition-colors group-hover:text-primary">
          {r.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description || "No description"}</p>

        <div className="mt-4 flex items-center justify-between pt-3 text-xs hairline">
          <span className="text-muted-foreground">MC {r.mc_version}</span>
          <span className="flex items-center gap-3">
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                isVip ? "bg-primary/15 text-primary" : "text-muted-foreground"
              }`}
            >
              {isVip ? "VIP" : "Free"}
            </span>
            <span className="text-foreground/80 transition-colors group-hover:text-primary">View details →</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

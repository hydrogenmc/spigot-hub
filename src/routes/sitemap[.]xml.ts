import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://cubyn.lovable.app";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [{ data: resources }, { data: categories }] = await Promise.all([
          supabaseAdmin.from("resources").select("slug, updated_at").eq("published", true).limit(5000),
          supabaseAdmin.from("categories").select("slug").limit(500),
        ]);

        const staticPaths = ["/", "/resources", "/categories", "/membership", "/about", "/contact", "/terms", "/privacy"];
        const urls: string[] = [];
        for (const p of staticPaths) {
          urls.push(`<url><loc>${BASE}${p}</loc><changefreq>weekly</changefreq><priority>${p === "/" ? "1.0" : "0.7"}</priority></url>`);
        }
        for (const c of categories ?? []) {
          urls.push(`<url><loc>${BASE}/resources?category=${encodeURIComponent(c.slug)}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`);
        }
        for (const r of resources ?? []) {
          const lastmod = r.updated_at ? `<lastmod>${new Date(r.updated_at).toISOString().slice(0, 10)}</lastmod>` : "";
          urls.push(`<url><loc>${BASE}/resources/${encodeURIComponent(r.slug)}</loc>${lastmod}<changefreq>weekly</changefreq><priority>0.8</priority></url>`);
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
        return new Response(xml, {
          headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
        });
      },
    },
  },
});

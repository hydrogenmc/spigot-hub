import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listResources = createServerFn({ method: "GET" })
  .inputValidator((d: { category?: string; mcVersion?: string; sort?: "newest" | "popular" | "downloads"; q?: string; featured?: boolean; limit?: number } = {}) =>
    z.object({
      category: z.string().optional(),
      mcVersion: z.string().optional(),
      sort: z.enum(["newest", "popular", "downloads"]).default("newest"),
      q: z.string().optional(),
      featured: z.boolean().optional(),
      limit: z.number().int().min(1).max(100).default(60),
    }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("resources")
      .select("id, slug, title, description, version, mc_version, author, thumbnail_url, download_count, featured, created_at, tags, category_id, categories(slug, name, icon)")
      .eq("published", true);
    if (data.category) {
      const { data: cat } = await supabaseAdmin.from("categories").select("id").eq("slug", data.category).maybeSingle();
      if (cat) q = q.eq("category_id", cat.id);
    }
    if (data.mcVersion) q = q.ilike("mc_version", `%${data.mcVersion}%`);
    if (data.q) q = q.or(`title.ilike.%${data.q}%,description.ilike.%${data.q}%`);
    if (data.featured) q = q.eq("featured", true);
    if (data.sort === "newest") q = q.order("created_at", { ascending: false });
    else q = q.order("download_count", { ascending: false });
    q = q.limit(data.limit);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getResource = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin.from("resources")
      .select("*, categories(slug, name, icon), resource_screenshots(url, sort_order)")
      .eq("slug", data.slug).eq("published", true).maybeSingle();
    if (error) throw new Error(error.message);
    return r;
  });

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("categories").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getStats = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ count }, { data: dl }] = await Promise.all([
    supabaseAdmin.from("resources").select("id", { count: "exact", head: true }).eq("published", true),
    supabaseAdmin.from("resources").select("download_count").eq("published", true),
  ]);
  const totalDownloads = (dl ?? []).reduce((s, r) => s + (r.download_count ?? 0), 0);
  return { totalResources: count ?? 0, totalDownloads };
});

export const trackDownload = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: count } = await supabaseAdmin.rpc("increment_download", { _resource_id: data.id });
    return { count: count ?? 0 };
  });

export const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("site_settings").select("data").eq("id", "main").maybeSingle();
  return { data: (data?.data ?? {}) as import("@/lib/site-settings").SiteSettings };
});

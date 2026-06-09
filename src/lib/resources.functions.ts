import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Extracts the object path inside the "resources" bucket from a stored URL.
function extractResourcesPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/resources\/([^?]+)/);
  if (m) return decodeURIComponent(m[1]);
  return null;
}

async function signIfBucketUrl(
  storage: { from: (b: string) => { createSignedUrl: (p: string, exp: number) => Promise<{ data: { signedUrl: string } | null }> } },
  url: string | null | undefined,
  expiresInSec = 60 * 60,
): Promise<string | null> {
  if (!url) return null;
  const path = extractResourcesPath(url);
  if (!path) return url;
  const { data } = await storage.from("resources").createSignedUrl(path, expiresInSec);
  return data?.signedUrl ?? null;
}

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
      .select("id, slug, title, description, version, mc_version, author, thumbnail_url, download_count, featured, created_at, tags, category_id, access_tier, credit_cost, categories(slug, name, icon)")
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
    const out = await Promise.all((rows ?? []).map(async (r) => ({
      ...r,
      thumbnail_url: await signIfBucketUrl(supabaseAdmin.storage, r.thumbnail_url),
    })));
    return out;
  });

export const getResource = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin.from("resources")
      .select("*, categories(slug, name, icon), resource_screenshots(url, sort_order)")
      .eq("slug", data.slug).eq("published", true).maybeSingle();
    if (error) throw new Error(error.message);
    if (!r) return null;
    const thumbnail_url = await signIfBucketUrl(supabaseAdmin.storage, r.thumbnail_url);
    const screenshots = await Promise.all(
      (r.resource_screenshots ?? []).map(async (s: { url: string; sort_order: number }) => ({
        ...s,
        url: (await signIfBucketUrl(supabaseAdmin.storage, s.url)) ?? s.url,
      })),
    );
    // strip raw file_url from public response; gated by getDownloadUrl
    const safe: Record<string, unknown> = { ...(r as Record<string, unknown>) };
    delete safe.file_url;
    safe.thumbnail_url = thumbnail_url;
    safe.resource_screenshots = screenshots;
    safe.has_file = !!(r as { file_url?: string }).file_url || !!(r as { external_url?: string }).external_url;
    return JSON.parse(JSON.stringify(safe)) as { id: string; slug: string; title: string; description: string; long_description?: string; changelog?: string; version: string; mc_version: string; author: string; tags: string[]; thumbnail_url: string | null; access_tier: string; credit_cost: number; download_count: number; created_at: string; categories?: { name?: string; slug?: string; icon?: string } | null; resource_screenshots: Array<{ url: string; sort_order: number }>; has_file: boolean };
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

export const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("site_settings").select("data").eq("id", "main").maybeSingle();
  return (data?.data ?? {}) as import("@/lib/site-settings").SiteSettings;
});

// ============================================================
// Auth-gated download
// ============================================================
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type DownloadResult =
  | { ok: true; url: string; tier: string; cost?: number; remainingBalance?: number }
  | { ok: false; reason: string; cost?: number; balance?: number; limit?: number };

export const getDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<DownloadResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    const { data: r, error: rErr } = await supabaseAdmin
      .from("resources")
      .select("id, file_url, external_url, access_tier, credit_cost")
      .eq("id", data.id)
      .eq("published", true)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!r) return { ok: false, reason: "not_found" };

    const { data: consume, error: cErr } = await supabaseAdmin.rpc("consume_download", { _uid: uid, _resource_id: data.id });
    if (cErr) throw new Error(cErr.message);
    const result = consume as { allowed: boolean; reason?: string; cost?: number; balance?: number; limit?: number };
    if (!result.allowed) {
      return { ok: false, reason: result.reason ?? "denied", cost: result.cost, balance: result.balance, limit: result.limit };
    }

    let signed: string | null = null;
    if (r.file_url) signed = await signIfBucketUrl(supabaseAdmin.storage, r.file_url, 60 * 10);
    const url = signed ?? r.external_url;
    if (!url) return { ok: false, reason: "no_file" };

    let remaining: number | undefined;
    if (r.access_tier === "credit") {
      const { data: prof } = await supabaseAdmin.from("profiles").select("credits_balance").eq("id", uid).maybeSingle();
      remaining = prof?.credits_balance ?? undefined;
    }
    return { ok: true, url, tier: r.access_tier, cost: r.access_tier === "credit" ? r.credit_cost : undefined, remainingBalance: remaining };
  });

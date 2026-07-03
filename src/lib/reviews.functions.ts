import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listReviews = createServerFn({ method: "GET" })
  .inputValidator((d: { resource_id: string }) => z.object({ resource_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("resource_reviews")
      .select("id, user_id, rating, body, created_at, updated_at")
      .eq("resource_id", data.resource_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const nameMap = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, display_name").in("id", ids);
      (profs ?? []).forEach((p) => nameMap.set(p.id, p.display_name ?? "User"));
    }
    const list = (rows ?? []).map((r) => ({ ...r, display_name: nameMap.get(r.user_id) ?? "User" }));
    const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
    return { reviews: list, avg, count: list.length };
  });

export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { resource_id: string; rating: number; body: string }) =>
    z.object({
      resource_id: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      body: z.string().max(2000).default(""),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("resource_reviews").upsert(
      { resource_id: data.resource_id, user_id: context.userId, rating: data.rating, body: data.body },
      { onConflict: "resource_id,user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { resource_id: string }) => z.object({ resource_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("resource_reviews").delete()
      .eq("resource_id", data.resource_id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export async function getCallerRoles(userId: string): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}

async function assertAdmin(userId: string) {
  await assertAnyRole(userId, ["admin"]);
}


export async function assertAnyRole(userId: string, allowed: string[]) {
  const roles = await getCallerRoles(userId);
  if (!roles.some((r) => allowed.includes(r))) {
    throw new Error(`Forbidden: requires one of ${allowed.join(", ")}`);
  }
}


const resourceSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/i, { message: "Slug must be letters, numbers, or dashes" }),
  title: z.string().min(1, { message: "Title is required" }).max(200),
  description: z.string().max(500).default(""),
  long_description: z.string().max(20000).default(""),
  version: z.string().min(1, { message: "Version is required" }).max(40),
  mc_version: z.string().min(1, { message: "MC Version is required" }).max(40),
  category_id: z.string().uuid().nullable(),
  author: z.string().min(1, { message: "Author is required" }).max(100),
  thumbnail_url: z.string().url().nullable().or(z.literal("")).transform(v => v || null),
  file_url: z.string().url().nullable().or(z.literal("")).transform(v => v || null),
  external_url: z.string().url().nullable().or(z.literal("")).transform(v => v || null),
  changelog: z.string().max(20000).default(""),
  tags: z.array(z.string().max(40)).max(20).default([]),
  dependencies: z.array(z.string().max(200)).max(30).default([]),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
  access_tier: z.enum(["free", "credit", "vip"]).default("free"),
  credit_cost: z.coerce.number({ invalid_type_error: "Credit cost must be a number" }).int({ message: "Credit cost must be a whole number" }).min(0).max(10000).default(0),
})
  .superRefine((v, ctx) => {
    if (v.access_tier === "credit" && (!Number.isFinite(v.credit_cost) || v.credit_cost < 1)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["credit_cost"], message: "Paid (credit) tier requires credit_cost >= 1" });
    }
  })
  .transform((v) => ({
    ...v,
    // Safety net: enforce min 1 for credit tier, zero for others.
    credit_cost: v.access_tier === "credit" ? Math.max(1, Math.floor(v.credit_cost)) : 0,
  }));

export const adminCheck = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const roles = await getCallerRoles(context.userId);
    return {
      isAdmin: roles.includes("admin"),
      isEditor: roles.includes("editor") || roles.includes("admin"),
      isBilling: roles.includes("billing") || roles.includes("admin"),
      roles,
      userId: context.userId,
    };
  });

export const adminListResources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAnyRole(context.userId, ["admin", "editor"]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("resources").select("*, categories(name, slug)").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminSaveResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => resourceSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAnyRole(context.userId, ["admin", "editor"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = { ...data };
    if (data.id) {
      const id = data.id;
      const { id: _i, ...rest } = payload;
      void _i;
      const { error } = await supabaseAdmin.from("resources").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    } else {
      const { id: _omit, ...insertPayload } = payload;
      void _omit;
      const withUploader = { ...insertPayload, uploader_id: context.userId };
      const { data: row, error } = await supabaseAdmin.from("resources").insert(withUploader).select("id").single();
      if (error) throw new Error(error.message);
      return { id: row.id };
    }
  });

export const adminDeleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAnyRole(context.userId, ["admin", "editor"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("resources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSaveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid().optional(),
    slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
    name: z.string().min(1).max(60),
    icon: z.string().max(40).nullable().default(null),
    description: z.string().max(300).nullable().default(null),
    sort_order: z.number().int().default(0),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAnyRole(context.userId, ["admin", "editor"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await supabaseAdmin.from("categories").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { id: _omit, ...insertData } = data;
    void _omit;
    const { data: row, error } = await supabaseAdmin.from("categories").insert(insertData).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const adminDeleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAnyRole(context.userId, ["admin", "editor"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { data: Record<string, unknown> }) => z.object({ data: z.record(z.string(), z.any()) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAnyRole(context.userId, ["admin"]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_settings").upsert({ id: "main", data: data.data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) => z.object({ path: z.string().min(1).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAnyRole(context.userId, ["admin", "editor"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage.from("resources").createSignedUploadUrl(data.path);
    if (error) throw new Error(error.message);
    const { data: pub } = supabaseAdmin.storage.from("resources").getPublicUrl(data.path);
    return { uploadUrl: signed.signedUrl, token: signed.token, path: data.path, publicUrl: pub.publicUrl };
  });

export const adminPromoteSelf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Admin already exists. Ask an existing admin to grant access.");
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

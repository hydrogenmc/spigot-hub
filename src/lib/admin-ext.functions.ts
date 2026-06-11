import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

// ------------------- Users -------------------
export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string } = {}) => z.object({ q: z.string().max(200).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const { data: profs } = await supabaseAdmin.from("profiles").select("id, display_name, credits_balance");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: vips } = await supabaseAdmin.from("vip_memberships").select("user_id, expires_at");
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role as string);
      roleMap.set(r.user_id, arr);
    });
    const vipMap = new Map<string, string | null>();
    (vips ?? []).forEach((v) => {
      const cur = vipMap.get(v.user_id);
      if (!cur || (v.expires_at && cur && new Date(v.expires_at).getTime() > new Date(cur).getTime())) {
        vipMap.set(v.user_id, v.expires_at);
      }
    });
    const q = data.q?.toLowerCase() ?? "";
    return (users?.users ?? [])
      .filter((u) => {
        if (!q) return true;
        return (u.email ?? "").toLowerCase().includes(q) || (profMap.get(u.id)?.display_name ?? "").toLowerCase().includes(q);
      })
      .map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        email_confirmed_at: u.email_confirmed_at,
        last_sign_in_at: u.last_sign_in_at,
        display_name: profMap.get(u.id)?.display_name ?? null,
        credits: profMap.get(u.id)?.credits_balance ?? 0,
        roles: roleMap.get(u.id) ?? [],
        vip_expires_at: vipMap.get(u.id) ?? null,
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  });

export const adminGrantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; role: "admin" | "vip" | "member"; grant: boolean }) =>
    z.object({ user_id: z.string().uuid(), role: z.enum(["admin", "vip", "member"]), grant: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      await supabaseAdmin.from("user_roles").upsert({ user_id: data.user_id, role: data.role }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", data.role);
    }
    return { ok: true };
  });

export const adminAdjustCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; delta: number; reason: string }) =>
    z.object({ user_id: z.string().uuid(), delta: z.number().int().min(-100000).max(100000), reason: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("admin_adjust_credits", { _uid: data.user_id, _delta: data.delta, _reason: data.reason });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------------- Plans -------------------
export const adminListPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("membership_plans").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({ ...p, price_php: Number(p.price_php) }));
  });

export const adminSavePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(80),
      description: z.string().max(500).default(""),
      price_php: z.number().min(0).max(1000000),
      duration_days: z.number().int().min(1).max(36500).nullable(),
      sort_order: z.number().int().default(0),
      active: z.boolean().default(true),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await supabaseAdmin.from("membership_plans").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { id: _o, ...insertData } = data;
    void _o;
    const { data: row, error } = await supabaseAdmin.from("membership_plans").insert(insertData).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const adminDeletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("membership_plans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------------- Receipts review -------------------
export const adminListReceipts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string } = {}) => z.object({ status: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("payment_receipts")
      .select("id, user_id, plan_id, method, status, ocr_amount_php, ocr_reference, ocr_confidence, flags, image_path, created_at, admin_notes, reviewed_at, membership_plans(name, price_php)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // sign image urls
    const out = await Promise.all((rows ?? []).map(async (r) => {
      const path = r.image_path ?? "";
      const { data: signed } = path ? await supabaseAdmin.storage.from("receipts").createSignedUrl(path, 60 * 30) : { data: null };
      return { ...r, image_url: signed?.signedUrl ?? null };
    }));
    return out;
  });

export const adminApproveReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; note?: string }) => z.object({ id: z.string().uuid(), note: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error: rErr } = await supabaseAdmin.from("payment_receipts").select("*").eq("id", data.id).single();
    if (rErr || !r) throw new Error("Receipt not found");
    if (r.status === "approved" || r.status === "auto_approved") return { ok: true, already: true };
    const { data: plan } = await supabaseAdmin.from("membership_plans").select("price_php").eq("id", r.plan_id).single();
    const { data: pay, error: payErr } = await supabaseAdmin.from("payments").insert({
      user_id: r.user_id, plan_id: r.plan_id,
      amount_php: r.ocr_amount_php ?? plan?.price_php ?? 0,
      method: r.method, provider: "receipt", provider_ref: r.ocr_reference,
      status: "paid", raw: { receipt_id: r.id },
    }).select("id").single();
    if (payErr) throw new Error(payErr.message);
    const { error: upErr } = await supabaseAdmin.from("payment_receipts").update({
      status: "approved", payment_id: pay.id, reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(), admin_notes: data.note ?? "",
    }).eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true, payment_id: pay.id };
  });

export const adminRejectReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; note: string }) => z.object({ id: z.string().uuid(), note: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("payment_receipts").update({
      status: "rejected", reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(), admin_notes: data.note,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------------- Bulk resource tier update -------------------
export const adminBulkUpdateTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[]; access_tier: "free" | "credit" | "vip"; credit_cost?: number }) =>
    z.object({
      ids: z.array(z.string().uuid()).min(1).max(500),
      access_tier: z.enum(["free", "credit", "vip"]),
      credit_cost: z.number().int().min(0).max(10000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { access_tier: data.access_tier };
    if (data.access_tier === "credit") patch.credit_cost = Math.max(1, data.credit_cost ?? 1);
    else patch.credit_cost = 0;
    const { error } = await supabaseAdmin.from("resources").update(patch).in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.ids.length };
  });

// ------------------- Memberships overview -------------------
export const adminListMemberships = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("vip_memberships")
      .select("id, user_id, plan_id, starts_at, expires_at, source, membership_plans(name)")
      .order("expires_at", { ascending: true, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

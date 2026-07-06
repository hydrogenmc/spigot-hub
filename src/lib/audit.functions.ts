import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import { assertAnyRole } from "@/lib/admin.functions";

async function assertAdmin(userId: string) {
  await assertAnyRole(userId, ["admin"]);
}


export const adminListAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { allowed?: "all" | "allowed" | "denied"; bypass?: "all" | "admin" | "vip" | "none"; q?: string; limit?: number } = {}) =>
    z.object({
      allowed: z.enum(["all", "allowed", "denied"]).default("all"),
      bypass: z.enum(["all", "admin", "vip", "none"]).default("all"),
      q: z.string().max(200).optional(),
      limit: z.number().int().min(1).max(500).default(200),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("access_audit_logs")
      .select("id, user_id, resource_id, allowed, tier, reason, cost, balance_after, bypass, created_at")
      .order("created_at", { ascending: false }).limit(data.limit);
    if (data.allowed === "allowed") q = q.eq("allowed", true);
    if (data.allowed === "denied") q = q.eq("allowed", false);
    if (data.bypass === "admin" || data.bypass === "vip") q = q.eq("bypass", data.bypass);
    if (data.bypass === "none") q = q.is("bypass", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id).filter(Boolean) as string[]));
    const resIds = Array.from(new Set((rows ?? []).map((r) => r.resource_id).filter(Boolean) as string[]));
    const nameMap = new Map<string, { email: string | null; display_name: string | null }>();
    if (userIds.length) {
      const { data: usr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
      (usr?.users ?? []).forEach((u) => nameMap.set(u.id, { email: u.email ?? null, display_name: null }));
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, display_name").in("id", userIds);
      (profs ?? []).forEach((p) => {
        const cur = nameMap.get(p.id) ?? { email: null, display_name: null };
        cur.display_name = p.display_name;
        nameMap.set(p.id, cur);
      });
    }
    const resMap = new Map<string, { title: string; slug: string }>();
    if (resIds.length) {
      const { data: res } = await supabaseAdmin.from("resources").select("id, title, slug").in("id", resIds);
      (res ?? []).forEach((r) => resMap.set(r.id, { title: r.title, slug: r.slug }));
    }
    const out = (rows ?? []).map((r) => ({
      ...r,
      user_email: r.user_id ? nameMap.get(r.user_id)?.email ?? null : null,
      user_name: r.user_id ? nameMap.get(r.user_id)?.display_name ?? null : null,
      resource_title: r.resource_id ? resMap.get(r.resource_id)?.title ?? null : null,
      resource_slug: r.resource_id ? resMap.get(r.resource_id)?.slug ?? null : null,
    }));
    // Aggregate summary
    const totals = { total: out.length, allowed: 0, denied: 0, admin_bypass: 0, vip_bypass: 0, credits_spent: 0 };
    out.forEach((r) => {
      if (r.allowed) totals.allowed++; else totals.denied++;
      if (r.bypass === "admin") totals.admin_bypass++;
      if (r.bypass === "vip") totals.vip_bypass++;
      if (r.allowed && (r.cost ?? 0) > 0) totals.credits_spent += r.cost;
    });
    return { logs: out, totals };
  });

// Quick update: bump version, replace file/external_url, append changelog
export const adminQuickUpdateResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; version: string; changelog_entry: string; file_url?: string | null; external_url?: string | null }) =>
    z.object({
      id: z.string().uuid(),
      version: z.string().min(1).max(40),
      changelog_entry: z.string().min(1).max(10000),
      file_url: z.string().url().nullable().optional(),
      external_url: z.string().url().nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAnyRole(context.userId, ["admin", "editor"]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current, error: gErr } = await supabaseAdmin
      .from("resources").select("changelog, version").eq("id", data.id).single();
    if (gErr) throw new Error(gErr.message);
    const dateStr = new Date().toISOString().slice(0, 10);
    const header = `<p><strong>v${data.version} — ${dateStr}</strong></p>`;
    const newChangelog = `${header}\n${data.changelog_entry}\n\n${current?.changelog ?? ""}`.slice(0, 20000);
    const patch: { version: string; changelog: string; file_url?: string | null; external_url?: string | null } = { version: data.version, changelog: newChangelog };
    if (data.file_url !== undefined) patch.file_url = data.file_url;
    if (data.external_url !== undefined) patch.external_url = data.external_url;
    const { error } = await supabaseAdmin.from("resources").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

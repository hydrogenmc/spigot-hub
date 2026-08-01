import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    const [{ data: profile }, { data: roleRows }, { data: vipRows }, { data: dlCount }, { data: settings }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, display_name, created_at").eq("id", uid).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", uid),
      supabaseAdmin.from("vip_memberships").select("plan_id, starts_at, expires_at").eq("user_id", uid).order("expires_at", { ascending: false, nullsFirst: false }).limit(5),
      supabaseAdmin.rpc("downloads_today", { _uid: uid }),
      supabaseAdmin.from("site_settings").select("data").eq("id", "main").maybeSingle(),
    ]);
    const roles = (roleRows ?? []).map((r) => r.role as string);
    const now = Date.now();
    const activeVip = (vipRows ?? []).find((v) => !v.expires_at || new Date(v.expires_at).getTime() > now) || null;
    const isAdmin = roles.includes("admin");
    // Admin OR vip role counts as VIP (role grant OR active membership record)
    const isVip = isAdmin || roles.includes("vip") || !!activeVip;
    const limits = (settings?.data as { limits?: { member_daily?: number; vip_daily?: number | null } } | undefined)?.limits ?? {};
    const dailyLimit = isVip ? (limits.vip_daily ?? null) : (limits.member_daily ?? 5);
    return {
      userId: uid,
      email: context.claims.email as string | undefined,
      profile,
      roles,
      isAdmin,
      isVip,
      vipExpiresAt: activeVip?.expires_at ?? null,
      downloadsToday: dlCount ?? 0,
      dailyLimit,
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { display_name: string }) =>
    z.object({ display_name: z.string().trim().min(1).max(60) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ display_name: data.display_name }).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

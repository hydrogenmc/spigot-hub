import { createServerFn } from "@tanstack/react-start";

export const listPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("membership_plans")
    .select("id, name, description, price_php, duration_days, sort_order, active")
    .eq("active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({ ...p, price_php: Number(p.price_php) }));
});

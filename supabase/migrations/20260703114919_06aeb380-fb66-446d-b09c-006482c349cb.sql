
-- ============ Uploader + dependencies on resources ============
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS uploader_id uuid,
  ADD COLUMN IF NOT EXISTS dependencies text[] NOT NULL DEFAULT '{}';

-- ============ Reviews ============
CREATE TABLE IF NOT EXISTS public.resource_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, user_id)
);
GRANT SELECT ON public.resource_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_reviews TO authenticated;
GRANT ALL ON public.resource_reviews TO service_role;
ALTER TABLE public.resource_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews public read" ON public.resource_reviews;
CREATE POLICY "reviews public read" ON public.resource_reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "reviews own write" ON public.resource_reviews;
CREATE POLICY "reviews own write" ON public.resource_reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "reviews own update" ON public.resource_reviews;
CREATE POLICY "reviews own update" ON public.resource_reviews
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "reviews own delete" ON public.resource_reviews;
CREATE POLICY "reviews own delete" ON public.resource_reviews
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'::app_role));

DROP TRIGGER IF EXISTS resource_reviews_updated_at ON public.resource_reviews;
CREATE TRIGGER resource_reviews_updated_at BEFORE UPDATE ON public.resource_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Access audit logs ============
CREATE TABLE IF NOT EXISTS public.access_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  resource_id uuid,
  allowed boolean NOT NULL,
  tier text,
  reason text,
  cost int NOT NULL DEFAULT 0,
  balance_after int,
  bypass text,      -- 'admin', 'vip', or null
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.access_audit_logs TO authenticated;
GRANT ALL ON public.access_audit_logs TO service_role;
ALTER TABLE public.access_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit admin read" ON public.access_audit_logs;
CREATE POLICY "audit admin read" ON public.access_audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE INDEX IF NOT EXISTS access_audit_logs_created_idx ON public.access_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS access_audit_logs_user_idx ON public.access_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS access_audit_logs_resource_idx ON public.access_audit_logs(resource_id);

-- ============ Rewrite consume_download to write audit rows ============
CREATE OR REPLACE FUNCTION public.consume_download(_uid uuid, _resource_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_check jsonb;
  v_cost int := 0;
  v_is_admin bool;
  v_is_vip bool;
  v_bypass text := NULL;
  v_tier text;
  v_balance int;
BEGIN
  v_check := public.can_download(_uid, _resource_id);
  v_tier := v_check->>'tier';
  IF NOT (v_check->>'allowed')::bool THEN
    INSERT INTO public.access_audit_logs(user_id, resource_id, allowed, tier, reason, cost, meta)
      VALUES (_uid, _resource_id, false, v_tier, v_check->>'reason', 0, v_check);
    RETURN v_check;
  END IF;
  v_is_admin := COALESCE((v_check->>'admin')::bool, false);
  v_is_vip := public.is_active_vip(_uid);
  IF v_is_admin THEN v_bypass := 'admin';
  ELSIF v_is_vip AND v_tier = 'credit' THEN v_bypass := 'vip';
  END IF;

  IF v_tier = 'credit' AND NOT v_is_admin THEN
    v_cost := (v_check->>'cost')::int;
    UPDATE public.profiles SET credits_balance = credits_balance - v_cost
      WHERE id = _uid AND credits_balance >= v_cost;
    IF NOT FOUND THEN
      INSERT INTO public.access_audit_logs(user_id, resource_id, allowed, tier, reason, cost, meta)
        VALUES (_uid, _resource_id, false, v_tier, 'insufficient_credits', v_cost, v_check);
      RETURN jsonb_build_object('allowed', false, 'reason', 'insufficient_credits');
    END IF;
    INSERT INTO public.credits_ledger(user_id, delta, reason, ref_id)
      VALUES (_uid, -v_cost, 'download', _resource_id::text);
  END IF;

  INSERT INTO public.download_logs(user_id, resource_id) VALUES (_uid, _resource_id);
  UPDATE public.resources SET download_count = download_count + 1 WHERE id = _resource_id;
  SELECT credits_balance INTO v_balance FROM public.profiles WHERE id = _uid;

  INSERT INTO public.access_audit_logs(user_id, resource_id, allowed, tier, reason, cost, balance_after, bypass, meta)
    VALUES (_uid, _resource_id, true, v_tier, 'download', v_cost, v_balance, v_bypass, v_check);

  RETURN jsonb_build_object('allowed', true);
END $function$;

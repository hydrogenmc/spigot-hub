
-- ============================================================
-- 1. Resources: support credit tier + cost
-- ============================================================
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS credit_cost integer NOT NULL DEFAULT 0;

-- access_tier is already text default 'free'; values now: free | credit | vip
-- enforce via trigger (avoid CHECK rigidity)
CREATE OR REPLACE FUNCTION public.validate_resource_access_tier()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.access_tier NOT IN ('free','credit','vip') THEN
    RAISE EXCEPTION 'invalid access_tier: %', NEW.access_tier;
  END IF;
  IF NEW.access_tier <> 'credit' THEN NEW.credit_cost := 0; END IF;
  IF NEW.access_tier = 'credit' AND NEW.credit_cost <= 0 THEN
    RAISE EXCEPTION 'credit_cost must be > 0 for credit tier';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS resources_validate_tier ON public.resources;
CREATE TRIGGER resources_validate_tier
  BEFORE INSERT OR UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.validate_resource_access_tier();

-- ============================================================
-- 2. Profiles: cached credit balance + daily login tracker
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_daily_claim_at timestamptz;

-- public read of leaderboard fields (display_name + credits_balance only)
DROP POLICY IF EXISTS "profiles public leaderboard" ON public.profiles;
CREATE POLICY "profiles public leaderboard"
  ON public.profiles FOR SELECT TO anon, authenticated
  USING (true);
GRANT SELECT ON public.profiles TO anon;

-- ============================================================
-- 3. Credits ledger (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.credits_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  delta integer NOT NULL,
  reason text NOT NULL,
  ref_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credits_ledger_user_idx ON public.credits_ledger(user_id, created_at DESC);

GRANT SELECT ON public.credits_ledger TO authenticated;
GRANT ALL ON public.credits_ledger TO service_role;

ALTER TABLE public.credits_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ledger self read" ON public.credits_ledger;
CREATE POLICY "ledger self read" ON public.credits_ledger
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- maintain cached balance
CREATE OR REPLACE FUNCTION public.apply_ledger_to_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET credits_balance = credits_balance + NEW.delta WHERE id = NEW.user_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS credits_ledger_balance ON public.credits_ledger;
CREATE TRIGGER credits_ledger_balance
  AFTER INSERT ON public.credits_ledger
  FOR EACH ROW EXECUTE FUNCTION public.apply_ledger_to_balance();

-- ============================================================
-- 4. New-user trigger: profile + role + signup bonus
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bonus integer;
BEGIN
  INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'member'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  SELECT COALESCE((data->'credits'->>'signup_bonus')::int, 20) INTO v_bonus
    FROM public.site_settings WHERE id='main';
  IF v_bonus IS NULL THEN v_bonus := 20; END IF;
  IF v_bonus > 0 THEN
    INSERT INTO public.credits_ledger(user_id, delta, reason)
      VALUES (NEW.id, v_bonus, 'signup_bonus');
  END IF;
  RETURN NEW;
END $$;

-- ============================================================
-- 5. Payment receipts (semi-automated OCR verification)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid REFERENCES public.membership_plans(id),
  method text NOT NULL CHECK (method IN ('gcash','maya')),
  image_path text NOT NULL,
  image_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','auto_approved','approved','rejected','flagged')),
  ocr_reference text,
  ocr_amount_php numeric,
  ocr_paid_at timestamptz,
  ocr_method text,
  ocr_confidence numeric,
  ocr_raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  flags text[] NOT NULL DEFAULT '{}'::text[],
  payment_id uuid REFERENCES public.payments(id),
  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_receipts_ref_unique
  ON public.payment_receipts(ocr_reference) WHERE ocr_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_receipts_hash_idx
  ON public.payment_receipts(image_sha256);
CREATE INDEX IF NOT EXISTS payment_receipts_status_idx
  ON public.payment_receipts(status, created_at DESC);

GRANT SELECT, INSERT ON public.payment_receipts TO authenticated;
GRANT ALL ON public.payment_receipts TO service_role;

ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receipts self read" ON public.payment_receipts;
CREATE POLICY "receipts self read" ON public.payment_receipts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "receipts self insert" ON public.payment_receipts;
CREATE POLICY "receipts self insert" ON public.payment_receipts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "receipts admin update" ON public.payment_receipts;
CREATE POLICY "receipts admin update" ON public.payment_receipts
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER payment_receipts_updated_at
  BEFORE UPDATE ON public.payment_receipts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 6. Storage RLS for receipts bucket
-- ============================================================
DROP POLICY IF EXISTS "receipts upload own" ON storage.objects;
CREATE POLICY "receipts upload own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "receipts read own or admin" ON storage.objects;
CREATE POLICY "receipts read own or admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- ============================================================
-- 7. Settings defaults (payment info, limits, credits, OCR)
-- ============================================================
INSERT INTO public.site_settings(id, data) VALUES('main','{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;
UPDATE public.site_settings
  SET data = data
    || jsonb_build_object('payment',
         COALESCE(data->'payment', '{}'::jsonb) ||
         jsonb_build_object(
           'gcash_number', COALESCE(data->'payment'->>'gcash_number',''),
           'gcash_name', COALESCE(data->'payment'->>'gcash_name',''),
           'maya_number', COALESCE(data->'payment'->>'maya_number',''),
           'maya_name', COALESCE(data->'payment'->>'maya_name',''),
           'instructions', COALESCE(data->'payment'->>'instructions',
             'Send payment to the GCash or Maya account above, then upload your receipt screenshot.'),
           'ocr_confidence_threshold', COALESCE((data->'payment'->>'ocr_confidence_threshold')::numeric, 0.8)
         ))
    || jsonb_build_object('limits',
         COALESCE(data->'limits', '{}'::jsonb) ||
         jsonb_build_object(
           'member_daily', COALESCE((data->'limits'->>'member_daily')::int, 10),
           'vip_daily', data->'limits'->'vip_daily'
         ))
    || jsonb_build_object('credits',
         COALESCE(data->'credits', '{}'::jsonb) ||
         jsonb_build_object(
           'signup_bonus', COALESCE((data->'credits'->>'signup_bonus')::int, 20),
           'daily_login', COALESCE((data->'credits'->>'daily_login')::int, 5)
         ))
  WHERE id = 'main';

-- ============================================================
-- 8. Helper SQL functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_daily_credits(_uid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_amount int;
  v_last timestamptz;
BEGIN
  SELECT COALESCE((data->'credits'->>'daily_login')::int, 5) INTO v_amount
    FROM public.site_settings WHERE id='main';
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'disabled');
  END IF;
  SELECT last_daily_claim_at INTO v_last FROM public.profiles WHERE id = _uid;
  IF v_last IS NOT NULL AND v_last > now() - interval '20 hours' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed', 'next_at', v_last + interval '20 hours');
  END IF;
  UPDATE public.profiles SET last_daily_claim_at = now() WHERE id = _uid;
  INSERT INTO public.credits_ledger(user_id, delta, reason) VALUES (_uid, v_amount, 'daily_login');
  RETURN jsonb_build_object('ok', true, 'awarded', v_amount);
END $$;

CREATE OR REPLACE FUNCTION public.can_download(_uid uuid, _resource_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tier text; v_cost int; v_balance int; v_today int;
  v_member_limit int; v_vip_limit int; v_is_vip bool;
BEGIN
  SELECT access_tier, credit_cost INTO v_tier, v_cost
    FROM public.resources WHERE id = _resource_id AND published = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_found');
  END IF;

  v_is_vip := public.is_active_vip(_uid);

  IF v_tier = 'vip' AND NOT v_is_vip THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'vip_required');
  END IF;

  -- daily limit
  SELECT COALESCE((data->'limits'->>'member_daily')::int, 10),
         NULLIF(data->'limits'->>'vip_daily','')::int
    INTO v_member_limit, v_vip_limit
    FROM public.site_settings WHERE id='main';
  SELECT public.downloads_today(_uid) INTO v_today;
  IF v_is_vip THEN
    IF v_vip_limit IS NOT NULL AND v_today >= v_vip_limit THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'limit_reached', 'limit', v_vip_limit);
    END IF;
  ELSE
    IF v_member_limit IS NOT NULL AND v_today >= v_member_limit THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'limit_reached', 'limit', v_member_limit);
    END IF;
  END IF;

  IF v_tier = 'credit' THEN
    SELECT credits_balance INTO v_balance FROM public.profiles WHERE id = _uid;
    IF v_balance < v_cost THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'insufficient_credits',
        'cost', v_cost, 'balance', COALESCE(v_balance,0));
    END IF;
    RETURN jsonb_build_object('allowed', true, 'tier', 'credit', 'cost', v_cost);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'tier', v_tier);
END $$;

-- atomic download consume: spends credits if needed, logs download
CREATE OR REPLACE FUNCTION public.consume_download(_uid uuid, _resource_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_check jsonb; v_cost int;
BEGIN
  v_check := public.can_download(_uid, _resource_id);
  IF NOT (v_check->>'allowed')::bool THEN RETURN v_check; END IF;
  IF v_check->>'tier' = 'credit' THEN
    v_cost := (v_check->>'cost')::int;
    -- re-check balance atomically
    UPDATE public.profiles SET credits_balance = credits_balance - v_cost
      WHERE id = _uid AND credits_balance >= v_cost;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'insufficient_credits');
    END IF;
    INSERT INTO public.credits_ledger(user_id, delta, reason, ref_id)
      VALUES (_uid, -v_cost, 'download', _resource_id::text);
  END IF;
  INSERT INTO public.download_logs(user_id, resource_id) VALUES (_uid, _resource_id);
  UPDATE public.resources SET download_count = download_count + 1 WHERE id = _resource_id;
  RETURN jsonb_build_object('allowed', true);
END $$;

-- admin: adjust credits
CREATE OR REPLACE FUNCTION public.admin_adjust_credits(_uid uuid, _delta int, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.credits_ledger(user_id, delta, reason) VALUES (_uid, _delta, COALESCE(_reason,'admin_adjust'));
END $$;

-- admin: approve a flagged receipt → create payment row that fires VIP grant
CREATE OR REPLACE FUNCTION public.admin_approve_receipt(_receipt_id uuid, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_r public.payment_receipts%ROWTYPE;
  v_plan public.membership_plans%ROWTYPE;
  v_pay_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO v_r FROM public.payment_receipts WHERE id = _receipt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_r.status IN ('approved','auto_approved') THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;
  SELECT * INTO v_plan FROM public.membership_plans WHERE id = v_r.plan_id;
  INSERT INTO public.payments(user_id, plan_id, amount_php, method, provider, provider_ref, status, raw)
    VALUES (v_r.user_id, v_r.plan_id, COALESCE(v_r.ocr_amount_php, v_plan.price_php),
            v_r.method, 'receipt', v_r.ocr_reference, 'paid',
            jsonb_build_object('receipt_id', v_r.id))
    RETURNING id INTO v_pay_id;
  UPDATE public.payment_receipts
    SET status = 'approved', payment_id = v_pay_id, reviewed_by = auth.uid(),
        reviewed_at = now(), admin_notes = _note
    WHERE id = _receipt_id;
  RETURN jsonb_build_object('ok', true, 'payment_id', v_pay_id);
END $$;

CREATE OR REPLACE FUNCTION public.admin_reject_receipt(_receipt_id uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.payment_receipts
    SET status='rejected', reviewed_by=auth.uid(), reviewed_at=now(), admin_notes=_note
    WHERE id=_receipt_id;
END $$;

-- ============================================================
-- 9. Expire VIP roles (daily cron)
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_vip_roles()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.user_roles ur
   WHERE ur.role = 'vip'::app_role
     AND NOT EXISTS (
       SELECT 1 FROM public.vip_memberships vm
        WHERE vm.user_id = ur.user_id
          AND (vm.expires_at IS NULL OR vm.expires_at > now())
     );
END $$;

CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN
  PERFORM cron.unschedule('expire-vip-roles');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('expire-vip-roles','15 0 * * *', $$SELECT public.expire_vip_roles();$$);

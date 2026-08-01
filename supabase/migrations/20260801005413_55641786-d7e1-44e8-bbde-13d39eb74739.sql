-- 1. Normalize resources off the credit tier
UPDATE public.resources SET access_tier = 'free', credit_cost = 0 WHERE access_tier = 'credit';

-- 2. Replace tier validation (free/vip only)
CREATE OR REPLACE FUNCTION public.validate_resource_access_tier()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.access_tier NOT IN ('free','vip') THEN
    RAISE EXCEPTION 'invalid access_tier: %', NEW.access_tier;
  END IF;
  RETURN NEW;
END $function$;

-- 3. can_download without credits
CREATE OR REPLACE FUNCTION public.can_download(_uid uuid, _resource_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tier text; v_today int;
  v_member_limit int; v_vip_limit int; v_is_vip bool; v_is_admin bool;
BEGIN
  SELECT access_tier INTO v_tier
    FROM public.resources WHERE id = _resource_id AND published = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_found');
  END IF;

  v_is_admin := public.has_role(_uid, 'admin'::app_role);
  v_is_vip := public.is_active_vip(_uid);

  IF v_tier = 'vip' AND NOT v_is_vip THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'vip_required');
  END IF;

  IF v_is_admin THEN
    RETURN jsonb_build_object('allowed', true, 'tier', v_tier, 'admin', true);
  END IF;

  SELECT COALESCE((data->'limits'->>'member_daily')::int, 5),
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

  RETURN jsonb_build_object('allowed', true, 'tier', v_tier);
END $function$;

-- 4. consume_download without credits
CREATE OR REPLACE FUNCTION public.consume_download(_uid uuid, _resource_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_check jsonb;
  v_is_admin bool;
  v_is_vip bool;
  v_bypass text := NULL;
  v_tier text;
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
  ELSIF v_is_vip THEN v_bypass := 'vip';
  END IF;

  INSERT INTO public.download_logs(user_id, resource_id) VALUES (_uid, _resource_id);
  UPDATE public.resources SET download_count = download_count + 1 WHERE id = _resource_id;

  INSERT INTO public.access_audit_logs(user_id, resource_id, allowed, tier, reason, cost, bypass, meta)
    VALUES (_uid, _resource_id, true, v_tier, 'download', 0, v_bypass, v_check);

  RETURN jsonb_build_object('allowed', true);
END $function$;

-- 5. Signup no longer grants credits
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'member'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END $function$;

-- 6. Drop credit-only functions
DROP FUNCTION IF EXISTS public.claim_daily_credits(uuid);
DROP FUNCTION IF EXISTS public.admin_adjust_credits(uuid, integer, text);
DROP FUNCTION IF EXISTS public.apply_ledger_to_balance() CASCADE;

-- 7. Drop credits tables/columns
DROP TABLE IF EXISTS public.credits_ledger CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS credits_balance;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS last_daily_claim_at;
ALTER TABLE public.resources DROP COLUMN IF EXISTS credit_cost;

-- 8. Clean settings
UPDATE public.site_settings SET data = data - 'credits' WHERE id = 'main';
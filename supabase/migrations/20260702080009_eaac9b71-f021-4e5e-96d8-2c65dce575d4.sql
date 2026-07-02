
CREATE OR REPLACE FUNCTION public.is_active_vip(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (
      SELECT 1 FROM public.vip_memberships
      WHERE user_id = _uid AND (expires_at IS NULL OR expires_at > now())
    )
    OR public.has_role(_uid, 'admin'::app_role)
    OR public.has_role(_uid, 'vip'::app_role);
$function$;

CREATE OR REPLACE FUNCTION public.can_download(_uid uuid, _resource_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tier text; v_cost int; v_balance int; v_today int;
  v_member_limit int; v_vip_limit int; v_is_vip bool; v_is_admin bool;
BEGIN
  SELECT access_tier, credit_cost INTO v_tier, v_cost
    FROM public.resources WHERE id = _resource_id AND published = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_found');
  END IF;

  v_is_admin := public.has_role(_uid, 'admin'::app_role);
  v_is_vip := public.is_active_vip(_uid);

  IF v_tier = 'vip' AND NOT v_is_vip THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'vip_required');
  END IF;

  -- Admins bypass daily limits and credit costs
  IF v_is_admin THEN
    RETURN jsonb_build_object('allowed', true, 'tier', v_tier, 'admin', true);
  END IF;

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
END $function$;

CREATE OR REPLACE FUNCTION public.consume_download(_uid uuid, _resource_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_check jsonb; v_cost int; v_is_admin bool;
BEGIN
  v_check := public.can_download(_uid, _resource_id);
  IF NOT (v_check->>'allowed')::bool THEN RETURN v_check; END IF;
  v_is_admin := COALESCE((v_check->>'admin')::bool, false);
  IF v_check->>'tier' = 'credit' AND NOT v_is_admin THEN
    v_cost := (v_check->>'cost')::int;
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
END $function$;

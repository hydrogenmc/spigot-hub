
-- Resources tier
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS access_tier text NOT NULL DEFAULT 'free'
    CHECK (access_tier IN ('free','vip'));

-- membership_plans
CREATE TABLE IF NOT EXISTS public.membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  duration_days integer,
  price_php numeric(10,2) NOT NULL CHECK (price_php >= 0),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.membership_plans TO anon, authenticated;
GRANT ALL ON public.membership_plans TO service_role;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans public read" ON public.membership_plans
  FOR SELECT USING (active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "plans admin write" ON public.membership_plans
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- payments
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.membership_plans(id) ON DELETE SET NULL,
  amount_php numeric(10,2) NOT NULL,
  method text NOT NULL CHECK (method IN ('gcash','paymaya','manual')),
  provider text NOT NULL DEFAULT 'paymongo',
  provider_ref text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','expired','cancelled')),
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_user_idx ON public.payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_provider_ref_idx ON public.payments(provider_ref);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments self read" ON public.payments
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "payments admin write" ON public.payments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- vip_memberships
CREATE TABLE IF NOT EXISTS public.vip_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.membership_plans(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  source text NOT NULL DEFAULT 'payment',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vip_user_idx ON public.vip_memberships(user_id, expires_at DESC NULLS FIRST);
GRANT SELECT ON public.vip_memberships TO authenticated;
GRANT ALL ON public.vip_memberships TO service_role;
ALTER TABLE public.vip_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vip self read" ON public.vip_memberships
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "vip admin write" ON public.vip_memberships
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- download_logs
CREATE TABLE IF NOT EXISTS public.download_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS download_logs_user_day_idx ON public.download_logs(user_id, created_at);
GRANT SELECT ON public.download_logs TO authenticated;
GRANT ALL ON public.download_logs TO service_role;
ALTER TABLE public.download_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "downloads self read" ON public.download_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- updated_at triggers
CREATE TRIGGER membership_plans_updated BEFORE UPDATE ON public.membership_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: active vip check
CREATE OR REPLACE FUNCTION public.is_active_vip(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vip_memberships
    WHERE user_id = _uid AND (expires_at IS NULL OR expires_at > now())
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_vip(uuid) FROM PUBLIC, anon, authenticated;

-- Helper: downloads today
CREATE OR REPLACE FUNCTION public.downloads_today(_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.download_logs
  WHERE user_id = _uid AND created_at >= date_trunc('day', now());
$$;
REVOKE ALL ON FUNCTION public.downloads_today(uuid) FROM PUBLIC, anon, authenticated;

-- Payment paid -> activate VIP
CREATE OR REPLACE FUNCTION public.handle_payment_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan public.membership_plans%ROWTYPE;
  v_now timestamptz := now();
  v_start timestamptz;
  v_expires timestamptz;
  v_existing_expires timestamptz;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') AND NEW.plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.membership_plans WHERE id = NEW.plan_id;
    SELECT max(expires_at) INTO v_existing_expires FROM public.vip_memberships
      WHERE user_id = NEW.user_id AND (expires_at IS NULL OR expires_at > v_now);
    IF v_existing_expires IS NULL THEN
      v_start := v_now;
    ELSE
      v_start := v_existing_expires;
    END IF;
    IF v_plan.duration_days IS NULL THEN
      v_expires := NULL;
    ELSE
      v_expires := v_start + (v_plan.duration_days || ' days')::interval;
    END IF;
    INSERT INTO public.vip_memberships(user_id, plan_id, payment_id, starts_at, expires_at, source)
      VALUES (NEW.user_id, NEW.plan_id, NEW.id, v_now, v_expires, 'payment');
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.user_id, 'vip'::app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    NEW.paid_at := v_now;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.handle_payment_paid() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS payments_paid_trigger ON public.payments;
CREATE TRIGGER payments_paid_trigger BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_paid();

-- Update handle_new_user to also seed 'member' role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'member'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill member role to existing users
INSERT INTO public.user_roles(user_id, role)
  SELECT id, 'member'::app_role FROM auth.users
  ON CONFLICT (user_id, role) DO NOTHING;

-- Seed plans
INSERT INTO public.membership_plans(name, description, duration_days, price_php, sort_order)
SELECT * FROM (VALUES
  ('30 Days VIP', 'One month of VIP access — unlimited downloads and premium resources.', 30, 99.00, 1),
  ('90 Days VIP', 'Three months of VIP access — best value for active users.', 90, 249.00, 2),
  ('Lifetime VIP', 'Pay once, VIP forever.', NULL::int, 999.00, 3)
) AS v(name, description, duration_days, price_php, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.membership_plans);

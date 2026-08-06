DROP POLICY IF EXISTS "resources public read" ON public.resources;
CREATE POLICY "resources published read" ON public.resources FOR SELECT TO anon, authenticated USING (published = true);
CREATE POLICY "resources admin read" ON public.resources FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "plans public read" ON public.membership_plans;
CREATE POLICY "plans active read" ON public.membership_plans FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "plans admin read" ON public.membership_plans FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));
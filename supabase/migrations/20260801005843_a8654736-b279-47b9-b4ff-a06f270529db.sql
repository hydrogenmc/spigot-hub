DROP POLICY IF EXISTS "profiles public leaderboard" ON public.profiles;
REVOKE SELECT ON public.profiles FROM anon;

CREATE POLICY "receipts owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'receipts' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "receipts admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'::app_role));
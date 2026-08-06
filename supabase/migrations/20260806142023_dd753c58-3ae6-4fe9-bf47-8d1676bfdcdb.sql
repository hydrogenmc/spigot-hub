DROP POLICY IF EXISTS "resources bucket public read" ON storage.objects;

CREATE POLICY "resources bucket admin read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'resources' AND public.has_role(auth.uid(), 'admin'::app_role));
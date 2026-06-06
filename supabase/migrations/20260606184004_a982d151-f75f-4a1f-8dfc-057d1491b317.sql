
CREATE POLICY "resources bucket public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'resources');
CREATE POLICY "resources bucket admin insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'resources' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "resources bucket admin update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'resources' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "resources bucket admin delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'resources' AND public.has_role(auth.uid(),'admin'));

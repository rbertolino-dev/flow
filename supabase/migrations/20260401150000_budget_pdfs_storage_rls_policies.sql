-- RLS do Storage para budget-pdfs (sem isso o upload falha: "new row violates row-level security policy")
-- Caminho dos arquivos: {organization_id}/budgets/arquivo.pdf

DROP POLICY IF EXISTS "Public read access to budget PDFs" ON storage.objects;
CREATE POLICY "Public read access to budget PDFs"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'budget-pdfs');

DROP POLICY IF EXISTS "Authenticated users can upload budget PDFs" ON storage.objects;
CREATE POLICY "Authenticated users can upload budget PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'budget-pdfs'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  )
);

DROP POLICY IF EXISTS "Authenticated users can update budget PDFs" ON storage.objects;
CREATE POLICY "Authenticated users can update budget PDFs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'budget-pdfs'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'budget-pdfs'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  )
);

DROP POLICY IF EXISTS "Authenticated users can delete budget PDFs" ON storage.objects;
CREATE POLICY "Authenticated users can delete budget PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'budget-pdfs'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  )
);

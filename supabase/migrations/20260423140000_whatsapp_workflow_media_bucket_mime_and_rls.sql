-- whatsapp-workflow-media: bucket + RLS explícitos (PDF, imagens, vídeos, anexos do funil)
-- Corrige falhas de upload quando allowed_mime_types ficou restrito (ex.: só PDF) ou políticas sombream / faltam.
-- Caminhos usados no app: {organization_id}/... ; exceção legada: logos/... (admin).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-workflow-media',
  'whatsapp-workflow-media',
  true,
  52428800, -- 50 MiB (alinha com 20260328130000; anexos de lead seguem 5 MB na tabela lead_attachments)
  NULL -- sem filtro de MIME: evita rejeição silenciosa de JPEG/PNG quando file.type vem vazio no mobile
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = GREATEST(COALESCE(storage.buckets.file_size_limit, 0), EXCLUDED.file_size_limit),
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Remover políticas antigas / duplicadas deste bucket (nomes históricos do projeto e scripts de fix)
DROP POLICY IF EXISTS "Allow authenticated users to upload status media" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to status media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their status media" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to workflow media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload workflow media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their workflow media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their workflow media" ON storage.objects;
DROP POLICY IF EXISTS "Users can view org workflow media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload org workflow media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete org workflow media" ON storage.objects;
DROP POLICY IF EXISTS "Workflow media read" ON storage.objects;
DROP POLICY IF EXISTS "Workflow media insert" ON storage.objects;
DROP POLICY IF EXISTS "Workflow media delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow PDF uploads for contracts" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to contract PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view org workflow media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete org workflow media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update org workflow media" ON storage.objects;

-- Políticas atuais (mesmo padrão de budget-pdfs + pasta logos/ para ferramentas admin)
DROP POLICY IF EXISTS "Workflow media: public read" ON storage.objects;
CREATE POLICY "Workflow media: public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'whatsapp-workflow-media');

DROP POLICY IF EXISTS "Workflow media: authenticated insert" ON storage.objects;
CREATE POLICY "Workflow media: authenticated insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'whatsapp-workflow-media'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_pubdigital_user(auth.uid())
    OR (storage.foldername(name))[1] IN (
      SELECT organization_id::text
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
    OR (
      (storage.foldername(name))[1] = 'logos'
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.is_pubdigital_user(auth.uid())
      )
    )
  )
);

DROP POLICY IF EXISTS "Workflow media: authenticated update" ON storage.objects;
CREATE POLICY "Workflow media: authenticated update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'whatsapp-workflow-media'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_pubdigital_user(auth.uid())
    OR (storage.foldername(name))[1] IN (
      SELECT organization_id::text
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
    OR (
      (storage.foldername(name))[1] = 'logos'
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.is_pubdigital_user(auth.uid())
      )
    )
  )
)
WITH CHECK (
  bucket_id = 'whatsapp-workflow-media'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_pubdigital_user(auth.uid())
    OR (storage.foldername(name))[1] IN (
      SELECT organization_id::text
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
    OR (
      (storage.foldername(name))[1] = 'logos'
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.is_pubdigital_user(auth.uid())
      )
    )
  )
);

DROP POLICY IF EXISTS "Workflow media: authenticated delete" ON storage.objects;
CREATE POLICY "Workflow media: authenticated delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'whatsapp-workflow-media'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_pubdigital_user(auth.uid())
    OR (storage.foldername(name))[1] IN (
      SELECT organization_id::text
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
    OR (
      (storage.foldername(name))[1] = 'logos'
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.is_pubdigital_user(auth.uid())
      )
    )
  )
);

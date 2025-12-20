-- ============================================
-- CORRIGIR POLÍTICAS RLS DO STORAGE (VERSÃO SIMPLES)
-- ============================================
-- Versão mais permissiva para garantir que uploads funcionem

-- 1. Garantir que o bucket existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-workflow-media',
  'whatsapp-workflow-media',
  true,
  16777216, -- 16MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'application/pdf']
)
ON CONFLICT (id) 
DO UPDATE SET 
  public = true,
  file_size_limit = 16777216,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'application/pdf'];

-- 2. Remover TODAS as políticas antigas conflitantes
DROP POLICY IF EXISTS "Users can view org workflow media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload org workflow media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete org workflow media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload status media" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to status media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their status media" ON storage.objects;
DROP POLICY IF EXISTS "Workflow media read" ON storage.objects;
DROP POLICY IF EXISTS "Workflow media insert" ON storage.objects;
DROP POLICY IF EXISTS "Workflow media delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow PDF uploads for contracts" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to contract PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to workflow media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view org workflow media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload workflow media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete org workflow media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update org workflow media" ON storage.objects;

-- 3. Criar políticas simples e permissivas

-- Política 1: SELECT (leitura) - Público para permitir acesso via Evolution API
CREATE POLICY "Public read access to workflow media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'whatsapp-workflow-media');

-- Política 2: INSERT (upload) - Qualquer usuário autenticado pode fazer upload
-- Mais permissiva para garantir que funcione
CREATE POLICY "Authenticated users can upload workflow media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-workflow-media');

-- Política 3: UPDATE - Usuários autenticados podem atualizar seus próprios arquivos
CREATE POLICY "Authenticated users can update their workflow media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'whatsapp-workflow-media'
  AND (
    owner = auth.uid()
    OR split_part(name, '/', 1) IN (
      SELECT organization_id::text FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  bucket_id = 'whatsapp-workflow-media'
  AND (
    owner = auth.uid()
    OR split_part(name, '/', 1) IN (
      SELECT organization_id::text FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
);

-- Política 4: DELETE - Usuários autenticados podem deletar seus próprios arquivos
CREATE POLICY "Authenticated users can delete their workflow media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'whatsapp-workflow-media'
  AND (
    owner = auth.uid()
    OR split_part(name, '/', 1) IN (
      SELECT organization_id::text FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
);

-- 4. Garantir que RLS está habilitado
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Verificar políticas criadas
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;



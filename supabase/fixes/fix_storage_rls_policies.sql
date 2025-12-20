-- ============================================
-- CORRIGIR POLÍTICAS RLS DO STORAGE
-- ============================================
-- Este script remove políticas conflitantes e cria políticas consistentes
-- para o bucket whatsapp-workflow-media

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

-- 3. Criar políticas consistentes e permissivas

-- Política 1: SELECT (leitura) - Público para permitir acesso via Evolution API
CREATE POLICY "Public read access to workflow media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'whatsapp-workflow-media');

-- Política 2: SELECT (leitura) - Autenticados podem ver arquivos de suas organizações
-- Se o caminho contém organization_id, verifica; senão, permite (fallback)
CREATE POLICY "Authenticated users can view org workflow media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'whatsapp-workflow-media'
  AND (
    -- Se o caminho começa com organization_id, verifica se usuário pertence à org
    -- Usa split_part para extrair a primeira pasta do caminho
    split_part(name, '/', 1) IN (
      SELECT organization_id::text FROM public.organization_members WHERE user_id = auth.uid()
    )
    -- Senão, permite (fallback para arquivos sem estrutura de pasta)
    OR split_part(name, '/', 1) = ''
    OR split_part(name, '/', 1) NOT IN (
      SELECT organization_id::text FROM public.organization_members
    )
  )
);

-- Política 3: INSERT (upload) - Autenticados podem fazer upload
-- Mais permissiva: permite upload se usuário está autenticado
-- Verifica organização apenas se o caminho contém organization_id
CREATE POLICY "Authenticated users can upload workflow media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'whatsapp-workflow-media'
  AND (
    -- Se o caminho começa com organization_id, verifica se usuário pertence à org
    split_part(name, '/', 1) IN (
      SELECT organization_id::text FROM public.organization_members WHERE user_id = auth.uid()
    )
    -- Senão, permite (fallback para uploads sem estrutura de pasta)
    OR split_part(name, '/', 1) = ''
    OR split_part(name, '/', 1) NOT IN (
      SELECT organization_id::text FROM public.organization_members
    )
  )
);

-- Política 4: DELETE - Autenticados podem deletar arquivos de suas organizações
CREATE POLICY "Authenticated users can delete org workflow media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'whatsapp-workflow-media'
  AND (
    -- Se o caminho começa com organization_id, verifica se usuário pertence à org
    split_part(name, '/', 1) IN (
      SELECT organization_id::text FROM public.organization_members WHERE user_id = auth.uid()
    )
    -- Senão, permite se o usuário é o dono do arquivo (owner = auth.uid())
    OR owner = auth.uid()
  )
);

-- Política 5: UPDATE - Autenticados podem atualizar arquivos de suas organizações
CREATE POLICY "Authenticated users can update org workflow media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'whatsapp-workflow-media'
  AND (
    split_part(name, '/', 1) IN (
      SELECT organization_id::text FROM public.organization_members WHERE user_id = auth.uid()
    )
    OR owner = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'whatsapp-workflow-media'
  AND (
    split_part(name, '/', 1) IN (
      SELECT organization_id::text FROM public.organization_members WHERE user_id = auth.uid()
    )
    OR owner = auth.uid()
  )
);

-- 4. Garantir que RLS está habilitado
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Verificar políticas criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;


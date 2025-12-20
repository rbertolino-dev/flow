-- ============================================
-- CORRIGIR POLÍTICAS RLS DO STORAGE
-- ============================================
-- IMPORTANTE: Este script pode falhar se você não for super admin
-- Se receber erro "must be owner of table objects", siga as instruções abaixo

-- ============================================
-- OPÇÃO 1: TENTAR VIA SQL (pode falhar)
-- ============================================

DO $$
BEGIN
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

  RAISE NOTICE '✅ Bucket configurado com sucesso';
  
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE '⚠️ Permissão insuficiente para criar/atualizar bucket.';
    RAISE NOTICE '   Configure manualmente no Dashboard (veja instruções abaixo)';
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Erro ao configurar bucket: %', SQLERRM;
END $$;

-- Tentar remover políticas antigas (pode falhar)
DO $$
BEGIN
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
  
  RAISE NOTICE '✅ Políticas antigas removidas';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE '⚠️ Permissão insuficiente. Remova políticas manualmente no Dashboard.';
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Erro ao remover políticas: %', SQLERRM;
END $$;

-- Tentar criar novas políticas (pode falhar)
DO $$
BEGIN
  -- Política 1: SELECT (leitura) - Público
  CREATE POLICY "Public read access to workflow media"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'whatsapp-workflow-media');
  
  -- Política 2: INSERT (upload) - Autenticados
  CREATE POLICY "Authenticated users can upload workflow media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'whatsapp-workflow-media');
  
  -- Política 3: UPDATE
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
  
  -- Política 4: DELETE
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
  
  RAISE NOTICE '✅ Políticas criadas com sucesso';
  
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE '⚠️ Permissão insuficiente para criar políticas.';
    RAISE NOTICE '   Configure manualmente no Dashboard (veja instruções abaixo)';
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Erro ao criar políticas: %', SQLERRM;
    RAISE NOTICE '   Configure manualmente no Dashboard (veja instruções abaixo)';
END $$;

-- ============================================
-- OPÇÃO 2: CONFIGURAR MANUALMENTE NO DASHBOARD
-- ============================================
-- Se o SQL acima falhar, siga estas instruções:

/*
INSTRUÇÕES PARA CONFIGURAR STORAGE NO SUPABASE DASHBOARD:

1. ACESSAR STORAGE:
   - Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/storage
   - Ou: Dashboard > Storage

2. CONFIGURAR BUCKET "whatsapp-workflow-media":
   - Clique em "New bucket" (se não existir) ou selecione o bucket existente
   - Nome: whatsapp-workflow-media
   - Public bucket: ✅ SIM (marcado)
   - File size limit: 16 MB
   - Allowed MIME types: 
     * image/jpeg
     * image/jpg
     * image/png
     * image/webp
     * video/mp4
     * video/quicktime
     * video/x-msvideo
     * application/pdf

3. CONFIGURAR POLÍTICAS RLS:
   - Vá em: Storage > Policies
   - Ou: Storage > whatsapp-workflow-media > Policies
   
   REMOVER TODAS AS POLÍTICAS ANTIGAS (se houver)

   CRIAR NOVA POLÍTICA 1 - "Public read access":
   - Policy name: Public read access to workflow media
   - Allowed operation: SELECT
   - Target roles: public
   - USING expression: bucket_id = 'whatsapp-workflow-media'
   
   CRIAR NOVA POLÍTICA 2 - "Authenticated upload":
   - Policy name: Authenticated users can upload workflow media
   - Allowed operation: INSERT
   - Target roles: authenticated
   - WITH CHECK expression: bucket_id = 'whatsapp-workflow-media'
   
   CRIAR NOVA POLÍTICA 3 - "Authenticated update":
   - Policy name: Authenticated users can update their workflow media
   - Allowed operation: UPDATE
   - Target roles: authenticated
   - USING expression: 
     bucket_id = 'whatsapp-workflow-media' AND (owner = auth.uid())
   - WITH CHECK expression:
     bucket_id = 'whatsapp-workflow-media' AND (owner = auth.uid())
   
   CRIAR NOVA POLÍTICA 4 - "Authenticated delete":
   - Policy name: Authenticated users can delete their workflow media
   - Allowed operation: DELETE
   - Target roles: authenticated
   - USING expression: 
     bucket_id = 'whatsapp-workflow-media' AND (owner = auth.uid())

4. SALVAR E TESTAR:
   - Salve todas as políticas
   - Recarregue o app
   - Tente fazer upload novamente
*/

-- Verificar políticas atuais (apenas leitura, não requer privilégios)
SELECT 
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;



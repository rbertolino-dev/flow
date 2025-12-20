-- ============================================
-- CRIAR POLÍTICAS DE STORAGE AUTOMATICAMENTE
-- ============================================
-- Execute este SQL no Supabase SQL Editor
-- Usa Service Role Key ou privilégios de super admin

-- 1. Remover políticas problemáticas (tuder5, comandos errados)
DO $$
BEGIN
  -- Remover políticas com "tuder5"
  DROP POLICY IF EXISTS "Authenticated users can update their workflow medi tuder5_0" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update their workflow medi tuder5_1" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload workflow media tuder5_0" ON storage.objects;
  DROP POLICY IF EXISTS "Delete Autenticado tuder5_0" ON storage.objects;
  DROP POLICY IF EXISTS "Delete Autenticado tuder5_1" ON storage.objects;
  DROP POLICY IF EXISTS "Public read access to workflow media tuder5_0" ON storage.objects;
  
  RAISE NOTICE '✅ Políticas problemáticas removidas';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE '⚠️ Permissão insuficiente para remover políticas';
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Erro ao remover políticas: %', SQLERRM;
END $$;

-- 2. Remover políticas antigas conflitantes (se existirem)
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
  
  RAISE NOTICE '✅ Políticas antigas removidas';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE '⚠️ Permissão insuficiente';
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Erro: %', SQLERRM;
END $$;

-- 3. Criar políticas principais (se não existirem)
DO $$
BEGIN
  -- Política 1: SELECT público
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects'
      AND policyname = 'Public read access to workflow media'
  ) THEN
    CREATE POLICY "Public read access to workflow media"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'whatsapp-workflow-media');
    RAISE NOTICE '✅ Política 1 criada: Public read access';
  ELSE
    RAISE NOTICE 'ℹ️ Política 1 já existe: Public read access';
  END IF;

  -- Política 2: INSERT autenticado
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload workflow media'
  ) THEN
    CREATE POLICY "Authenticated users can upload workflow media"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'whatsapp-workflow-media');
    RAISE NOTICE '✅ Política 2 criada: Authenticated upload';
  ELSE
    RAISE NOTICE 'ℹ️ Política 2 já existe: Authenticated upload';
  END IF;

  -- Política 3: UPDATE autenticado
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can update their workflow media'
  ) THEN
    CREATE POLICY "Authenticated users can update their workflow media"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'whatsapp-workflow-media'
      AND owner = auth.uid()
    )
    WITH CHECK (
      bucket_id = 'whatsapp-workflow-media'
      AND owner = auth.uid()
    );
    RAISE NOTICE '✅ Política 3 criada: Authenticated update';
  ELSE
    RAISE NOTICE 'ℹ️ Política 3 já existe: Authenticated update';
  END IF;

  -- Política 4: DELETE autenticado
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can delete their workflow media'
  ) THEN
    CREATE POLICY "Authenticated users can delete their workflow media"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'whatsapp-workflow-media'
      AND owner = auth.uid()
    );
    RAISE NOTICE '✅ Política 4 criada: Authenticated delete';
  ELSE
    RAISE NOTICE 'ℹ️ Política 4 já existe: Authenticated delete';
  END IF;

  -- Política 5: INSERT para contratos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects'
      AND policyname = 'Allow PDF uploads for contracts'
  ) THEN
    CREATE POLICY "Allow PDF uploads for contracts"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'whatsapp-workflow-media'
      AND (
        name LIKE '%/contracts/%'
        OR name LIKE '%contracts/%'
        OR name LIKE 'contracts/%'
      )
    );
    RAISE NOTICE '✅ Política 5 criada: PDF uploads for contracts';
  ELSE
    RAISE NOTICE 'ℹ️ Política 5 já existe: PDF uploads for contracts';
  END IF;

  -- Política 6: SELECT público para contratos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects'
      AND policyname = 'Allow public read access to contract PDFs'
  ) THEN
    CREATE POLICY "Allow public read access to contract PDFs"
    ON storage.objects
    FOR SELECT
    TO public
    USING (
      bucket_id = 'whatsapp-workflow-media'
      AND (
        name LIKE '%/contracts/%'
        OR name LIKE '%contracts/%'
        OR name LIKE 'contracts/%'
      )
    );
    RAISE NOTICE '✅ Política 6 criada: Public read access to contract PDFs';
  ELSE
    RAISE NOTICE 'ℹ️ Política 6 já existe: Public read access to contract PDFs';
  END IF;

EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE '❌ Permissão insuficiente para criar políticas';
    RAISE NOTICE '   Execute manualmente no Dashboard do Supabase';
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Erro ao criar políticas: %', SQLERRM;
    RAISE NOTICE '   Execute manualmente no Dashboard do Supabase';
END $$;

-- 4. Verificar políticas criadas
SELECT 
  policyname,
  cmd,
  roles,
  CASE 
    WHEN policyname IN (
      'Public read access to workflow media',
      'Authenticated users can upload workflow media',
      'Authenticated users can update their workflow media',
      'Authenticated users can delete their workflow media',
      'Allow PDF uploads for contracts',
      'Allow public read access to contract PDFs'
    ) THEN '✅ OK'
    ELSE '⚠️ Outra política'
  END AS status
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;



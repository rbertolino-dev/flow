-- ============================================
-- VERIFICAR POLÍTICAS RLS DO STORAGE
-- ============================================
-- Execute este SQL no Supabase SQL Editor para verificar se as políticas estão corretas

-- 1. Verificar se o bucket existe e está configurado corretamente
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE id = 'whatsapp-workflow-media';

-- 2. Verificar todas as políticas do storage.objects
SELECT 
  policyname,
  cmd AS operation,
  roles,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY 
  CASE cmd
    WHEN 'SELECT' THEN 1
    WHEN 'INSERT' THEN 2
    WHEN 'UPDATE' THEN 3
    WHEN 'DELETE' THEN 4
    ELSE 5
  END,
  policyname;

-- 3. Verificar se RLS está habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'storage'
  AND tablename = 'objects';

-- 4. Contar políticas por operação
SELECT 
  cmd AS operation,
  COUNT(*) AS policy_count,
  STRING_AGG(policyname, ', ') AS policy_names
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
GROUP BY cmd
ORDER BY 
  CASE cmd
    WHEN 'SELECT' THEN 1
    WHEN 'INSERT' THEN 2
    WHEN 'UPDATE' THEN 3
    WHEN 'DELETE' THEN 4
    ELSE 5
  END;

-- 5. Verificar se as políticas esperadas existem
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
        AND tablename = 'objects'
        AND policyname = 'Public read access to workflow media'
        AND cmd = 'SELECT'
        AND 'public' = ANY(roles)
    ) THEN '✅ Política 1: Public read access - OK'
    ELSE '❌ Política 1: Public read access - FALTANDO'
  END AS status_policy_1,
  
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
        AND tablename = 'objects'
        AND policyname = 'Authenticated users can upload workflow media'
        AND cmd = 'INSERT'
        AND 'authenticated' = ANY(roles)
    ) THEN '✅ Política 2: Authenticated upload - OK'
    ELSE '❌ Política 2: Authenticated upload - FALTANDO'
  END AS status_policy_2,
  
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
        AND tablename = 'objects'
        AND policyname = 'Authenticated users can update their workflow media'
        AND cmd = 'UPDATE'
        AND 'authenticated' = ANY(roles)
    ) THEN '✅ Política 3: Authenticated update - OK'
    ELSE '❌ Política 3: Authenticated update - FALTANDO'
  END AS status_policy_3,
  
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
        AND tablename = 'objects'
        AND policyname = 'Authenticated users can delete their workflow media'
        AND cmd = 'DELETE'
        AND 'authenticated' = ANY(roles)
    ) THEN '✅ Política 4: Authenticated delete - OK'
    ELSE '❌ Política 4: Authenticated delete - FALTANDO'
  END AS status_policy_4;



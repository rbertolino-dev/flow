-- ============================================
-- ANALISAR TODAS AS POLÍTICAS DE STORAGE
-- ============================================
-- Este script mostra TODAS as políticas e identifica:
-- 1. Quais são necessárias
-- 2. Quais são duplicadas
-- 3. Quais têm problemas (comandos errados)
-- 4. Quais devem ser mantidas

-- 1. Listar TODAS as políticas do storage.objects
SELECT 
  policyname AS "Nome da Política",
  cmd AS "Operação",
  roles AS "Roles",
  CASE 
    WHEN qual IS NULL THEN '(vazio)'
    ELSE LEFT(qual, 100) || '...'
  END AS "USING (primeiros 100 chars)",
  CASE 
    WHEN with_check IS NULL THEN '(vazio)'
    ELSE LEFT(with_check, 100) || '...'
  END AS "WITH CHECK (primeiros 100 chars)"
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;

-- 2. Identificar políticas necessárias vs duplicadas
SELECT 
  policyname,
  cmd,
  CASE 
    -- Políticas principais esperadas
    WHEN policyname = 'Public read access to workflow media' 
         AND cmd = 'SELECT' 
         AND 'public' = ANY(roles) THEN '✅ NECESSÁRIA - Principal'
    
    WHEN policyname = 'Authenticated users can upload workflow media' 
         AND cmd = 'INSERT' 
         AND 'authenticated' = ANY(roles) THEN '✅ NECESSÁRIA - Principal'
    
    WHEN policyname = 'Authenticated users can update their workflow media' 
         AND cmd = 'UPDATE' 
         AND 'authenticated' = ANY(roles) THEN '✅ NECESSÁRIA - Principal'
    
    WHEN policyname = 'Authenticated users can delete their workflow media' 
         AND cmd = 'DELETE' 
         AND 'authenticated' = ANY(roles) THEN '✅ NECESSÁRIA - Principal'
    
    -- Políticas para contratos (específicas)
    WHEN policyname LIKE '%contract%' 
         AND (cmd = 'INSERT' OR cmd = 'SELECT') THEN '✅ NECESSÁRIA - Para Contratos'
    
    -- Políticas antigas que podem ser substituídas
    WHEN policyname LIKE '%tuder5%' THEN '⚠️ DUPLICADA - Nome estranho (tuder5)'
    
    WHEN policyname LIKE '%workflow media%' 
         AND policyname NOT IN (
           'Public read access to workflow media',
           'Authenticated users can upload workflow media',
           'Authenticated users can update their workflow media',
           'Authenticated users can delete their workflow media'
         ) THEN '⚠️ DUPLICADA - Nome diferente'
    
    -- Políticas com comandos errados
    WHEN policyname LIKE '%update%' AND cmd != 'UPDATE' THEN '❌ ERRO - Comando errado (deveria ser UPDATE)'
    WHEN policyname LIKE '%delete%' AND cmd != 'DELETE' THEN '❌ ERRO - Comando errado (deveria ser DELETE)'
    WHEN policyname LIKE '%upload%' AND cmd != 'INSERT' THEN '❌ ERRO - Comando errado (deveria ser INSERT)'
    
    ELSE '❓ VERIFICAR - Pode ser necessária'
  END AS status,
  CASE 
    WHEN cmd = 'SELECT' AND policyname LIKE '%update%' THEN '⚠️ ATENÇÃO: Política de UPDATE com comando SELECT!'
    WHEN cmd = 'SELECT' AND policyname LIKE '%delete%' THEN '⚠️ ATENÇÃO: Política de DELETE com comando SELECT!'
    WHEN cmd = 'SELECT' AND policyname LIKE '%upload%' THEN '⚠️ ATENÇÃO: Política de UPLOAD com comando SELECT!'
    ELSE ''
  END AS alerta
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY 
  CASE 
    WHEN policyname LIKE '%tuder5%' THEN 1
    WHEN policyname LIKE '%update%' AND cmd != 'UPDATE' THEN 2
    WHEN policyname LIKE '%delete%' AND cmd != 'DELETE' THEN 2
    ELSE 3
  END,
  policyname;

-- 3. Resumo: Contar políticas por tipo
SELECT 
  'Total de políticas' AS tipo,
  COUNT(*) AS quantidade
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'

UNION ALL

SELECT 
  'Políticas com nome "tuder5"' AS tipo,
  COUNT(*) AS quantidade
FROM pg_policies
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%tuder5%'

UNION ALL

SELECT 
  'Políticas com comando errado' AS tipo,
  COUNT(*) AS quantidade
FROM pg_policies
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND (
    (policyname LIKE '%update%' AND cmd != 'UPDATE')
    OR (policyname LIKE '%delete%' AND cmd != 'DELETE')
    OR (policyname LIKE '%upload%' AND cmd != 'INSERT')
  );

-- 4. Recomendação final
SELECT 
  CASE 
    WHEN COUNT(*) = 4 
         AND COUNT(CASE WHEN policyname = 'Public read access to workflow media' THEN 1 END) = 1
         AND COUNT(CASE WHEN policyname = 'Authenticated users can upload workflow media' THEN 1 END) = 1
         AND COUNT(CASE WHEN policyname = 'Authenticated users can update their workflow media' THEN 1 END) = 1
         AND COUNT(CASE WHEN policyname = 'Authenticated users can delete their workflow media' THEN 1 END) = 1
    THEN '✅ PERFEITO: Exatamente 4 políticas principais corretas'
    
    WHEN COUNT(*) > 4 THEN 
      '⚠️ ATENÇÃO: Há ' || COUNT(*) || ' políticas. Algumas podem ser duplicadas ou desnecessárias.'
    
    WHEN COUNT(*) < 4 THEN 
      '❌ FALTANDO: Apenas ' || COUNT(*) || ' políticas. Devem ser 4 principais.'
    
    ELSE '❓ VERIFICAR: Configuração não padrão'
  END AS recomendacao
FROM pg_policies
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname IN (
    'Public read access to workflow media',
    'Authenticated users can upload workflow media',
    'Authenticated users can update their workflow media',
    'Authenticated users can delete their workflow media'
  );



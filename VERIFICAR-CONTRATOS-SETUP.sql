-- ============================================
-- VERIFICAÇÃO DETALHADA: Sistema de Contratos
-- ============================================
-- Execute este SQL para verificar se tudo está configurado corretamente
-- ============================================

-- 1. Verificar se tabela contract_templates existe
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'contract_templates'
    ) THEN '✅ Tabela contract_templates existe'
    ELSE '❌ Tabela contract_templates NÃO existe'
  END AS status_tabela;

-- 2. Verificar se coluna cover_page_url existe
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'contract_templates' 
      AND column_name = 'cover_page_url'
    ) THEN '✅ Coluna cover_page_url existe'
    ELSE '❌ Coluna cover_page_url NÃO existe'
  END AS status_cover_page_url;

-- 3. Verificar se bucket existe
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM storage.buckets WHERE id = 'whatsapp-workflow-media'
    ) THEN '✅ Bucket whatsapp-workflow-media existe'
    ELSE '❌ Bucket whatsapp-workflow-media NÃO existe'
  END AS status_bucket;

-- 4. Verificar allowed_mime_types do bucket (detalhado)
SELECT 
  id,
  name,
  public,
  allowed_mime_types,
  CASE 
    WHEN allowed_mime_types IS NULL THEN '⚠️ allowed_mime_types é NULL (aceita todos)'
    WHEN 'application/pdf' = ANY(allowed_mime_types) 
    THEN '✅ PDF permitido'
    ELSE '❌ PDF NÃO está nos allowed_mime_types'
  END AS status_pdf,
  CASE 
    WHEN allowed_mime_types IS NULL THEN 'Adicione application/pdf manualmente'
    WHEN 'application/pdf' = ANY(allowed_mime_types) THEN 'OK'
    ELSE 'Execute: UPDATE storage.buckets SET allowed_mime_types = array_cat(allowed_mime_types, ARRAY[''application/pdf'']) WHERE id = ''whatsapp-workflow-media'';'
  END AS acao_necessaria
FROM storage.buckets 
WHERE id = 'whatsapp-workflow-media';

-- 5. Verificar políticas RLS para contratos
SELECT 
  policyname,
  cmd AS comando,
  CASE 
    WHEN cmd = 'INSERT' THEN '✅ Política de INSERT existe'
    WHEN cmd = 'SELECT' THEN '✅ Política de SELECT existe'
    WHEN cmd = 'UPDATE' THEN '✅ Política de UPDATE existe'
    WHEN cmd = 'DELETE' THEN '✅ Política de DELETE existe'
    ELSE '⚠️ Política desconhecida'
  END AS status
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%contract%'
ORDER BY policyname;

-- 6. Verificar políticas RLS da tabela contract_templates
SELECT 
  policyname,
  cmd AS comando,
  CASE 
    WHEN cmd = 'SELECT' THEN '✅ Política de SELECT existe'
    WHEN cmd = 'INSERT' THEN '✅ Política de INSERT existe'
    WHEN cmd = 'UPDATE' THEN '✅ Política de UPDATE existe'
    WHEN cmd = 'DELETE' THEN '✅ Política de DELETE existe'
    ELSE '⚠️ Política desconhecida'
  END AS status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'contract_templates'
ORDER BY policyname;

-- 7. Resumo completo com diagnóstico
SELECT 
  'RESUMO' AS tipo,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'contract_templates'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'contract_templates' 
      AND column_name = 'cover_page_url'
    ) AND EXISTS (
      SELECT 1 FROM storage.buckets WHERE id = 'whatsapp-workflow-media'
    ) AND EXISTS (
      SELECT 1 FROM storage.buckets 
      WHERE id = 'whatsapp-workflow-media'
      AND (
        allowed_mime_types IS NULL 
        OR 'application/pdf' = ANY(COALESCE(allowed_mime_types, ARRAY[]::text[]))
      )
    )
    THEN '✅ Tudo configurado corretamente!'
    ELSE '❌ Alguma configuração está faltando. Execute SQL-EXECUTAR-SUPABASE.sql'
  END AS status_geral,
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'contract_templates'
    ) THEN 'Falta: Tabela contract_templates'
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'contract_templates' 
      AND column_name = 'cover_page_url'
    ) THEN 'Falta: Coluna cover_page_url'
    WHEN NOT EXISTS (
      SELECT 1 FROM storage.buckets WHERE id = 'whatsapp-workflow-media'
    ) THEN 'Falta: Bucket whatsapp-workflow-media'
    WHEN NOT EXISTS (
      SELECT 1 FROM storage.buckets 
      WHERE id = 'whatsapp-workflow-media'
      AND (
        allowed_mime_types IS NULL 
        OR 'application/pdf' = ANY(COALESCE(allowed_mime_types, ARRAY[]::text[]))
      )
    ) THEN 'Falta: application/pdf nos allowed_mime_types do bucket'
    ELSE 'Tudo OK'
  END AS diagnostico;


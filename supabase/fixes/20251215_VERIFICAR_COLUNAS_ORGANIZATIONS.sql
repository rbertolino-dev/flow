-- ============================================
-- VERIFICAÇÃO: Verificar se colunas de organizations existem
-- Execute no Supabase SQL Editor
-- ============================================
-- Este script verifica se todas as colunas foram criadas corretamente

-- Verificar todas as colunas da tabela organizations
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE 
    WHEN column_name IN (
      'business_type',
      'company_profile',
      'state',
      'city',
      'tax_regime',
      'expectations',
      'onboarding_completed',
      'onboarding_completed_at'
    ) THEN '✅ Coluna de onboarding'
    ELSE 'Outra coluna'
  END as tipo
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'organizations'
ORDER BY 
  CASE 
    WHEN column_name IN (
      'business_type',
      'company_profile',
      'state',
      'city',
      'tax_regime',
      'expectations',
      'onboarding_completed',
      'onboarding_completed_at'
    ) THEN 0
    ELSE 1
  END,
  column_name;

-- Verificar especificamente as colunas de onboarding
SELECT 
  'business_type' as coluna,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organizations' 
      AND column_name = 'business_type'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status
UNION ALL
SELECT 'company_profile', CASE WHEN EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'company_profile'
) THEN '✅ Existe' ELSE '❌ Não existe' END
UNION ALL
SELECT 'state', CASE WHEN EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'state'
) THEN '✅ Existe' ELSE '❌ Não existe' END
UNION ALL
SELECT 'city', CASE WHEN EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'city'
) THEN '✅ Existe' ELSE '❌ Não existe' END
UNION ALL
SELECT 'tax_regime', CASE WHEN EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'tax_regime'
) THEN '✅ Existe' ELSE '❌ Não existe' END
UNION ALL
SELECT 'expectations', CASE WHEN EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'expectations'
) THEN '✅ Existe' ELSE '❌ Não existe' END
UNION ALL
SELECT 'onboarding_completed', CASE WHEN EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'onboarding_completed'
) THEN '✅ Existe' ELSE '❌ Não existe' END
UNION ALL
SELECT 'onboarding_completed_at', CASE WHEN EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'onboarding_completed_at'
) THEN '✅ Existe' ELSE '❌ Não existe' END;


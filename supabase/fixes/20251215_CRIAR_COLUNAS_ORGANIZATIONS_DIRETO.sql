-- ============================================
-- CRIAR COLUNAS: Adicionar colunas de onboarding em organizations
-- Execute no Supabase SQL Editor
-- ============================================
-- Este script cria as colunas DIRETAMENTE (sem blocos DO $$)
-- Use este script se as colunas não existirem

-- Verificar se a tabela organizations existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organizations'
  ) THEN
    RAISE EXCEPTION 'Tabela organizations não existe!';
  END IF;
END $$;

-- Adicionar colunas DIRETAMENTE (forma mais confiável)
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS business_type TEXT;

ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS company_profile TEXT;

ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS state TEXT;

ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS tax_regime TEXT;

ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS expectations TEXT;

ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Adicionar comentários
COMMENT ON COLUMN public.organizations.business_type IS 'Tipo de negócio: products_and_services, products_only, services_only';
COMMENT ON COLUMN public.organizations.company_profile IS 'Perfil da empresa: MEI, ME, EIRELI, LTDA, etc.';
COMMENT ON COLUMN public.organizations.state IS 'Estado da organização';
COMMENT ON COLUMN public.organizations.city IS 'Cidade da organização';
COMMENT ON COLUMN public.organizations.tax_regime IS 'Regime tributário: MEI, ME, Simples Nacional, Lucro Presumido, Lucro Real';
COMMENT ON COLUMN public.organizations.expectations IS 'O que a empresa espera do sistema';
COMMENT ON COLUMN public.organizations.onboarding_completed IS 'Indica se o onboarding foi completado';
COMMENT ON COLUMN public.organizations.onboarding_completed_at IS 'Data e hora de conclusão do onboarding';

-- Verificar se foram criadas
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

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Após executar, todas as colunas devem aparecer como "✅ Existe"
-- Aguarde 30-60 segundos e recarregue a página do cadastro

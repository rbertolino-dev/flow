-- ============================================
-- FORCE: Criar colunas de onboarding em organizations
-- Execute no Supabase SQL Editor
-- ============================================
-- Este script FORÇA a criação das colunas mesmo se já existirem

-- Verificar e criar cada coluna individualmente
DO $$
BEGIN
  -- business_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organizations' 
      AND column_name = 'business_type'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN business_type TEXT;
    RAISE NOTICE '✅ Coluna business_type criada';
  ELSE
    RAISE NOTICE 'ℹ️ Coluna business_type já existe';
  END IF;

  -- company_profile
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organizations' 
      AND column_name = 'company_profile'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN company_profile TEXT;
    RAISE NOTICE '✅ Coluna company_profile criada';
  ELSE
    RAISE NOTICE 'ℹ️ Coluna company_profile já existe';
  END IF;

  -- state
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organizations' 
      AND column_name = 'state'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN state TEXT;
    RAISE NOTICE '✅ Coluna state criada';
  ELSE
    RAISE NOTICE 'ℹ️ Coluna state já existe';
  END IF;

  -- city
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organizations' 
      AND column_name = 'city'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN city TEXT;
    RAISE NOTICE '✅ Coluna city criada';
  ELSE
    RAISE NOTICE 'ℹ️ Coluna city já existe';
  END IF;

  -- tax_regime
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organizations' 
      AND column_name = 'tax_regime'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN tax_regime TEXT;
    RAISE NOTICE '✅ Coluna tax_regime criada';
  ELSE
    RAISE NOTICE 'ℹ️ Coluna tax_regime já existe';
  END IF;

  -- expectations
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organizations' 
      AND column_name = 'expectations'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN expectations TEXT;
    RAISE NOTICE '✅ Coluna expectations criada';
  ELSE
    RAISE NOTICE 'ℹ️ Coluna expectations já existe';
  END IF;

  -- onboarding_completed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organizations' 
      AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Coluna onboarding_completed criada';
  ELSE
    RAISE NOTICE 'ℹ️ Coluna onboarding_completed já existe';
  END IF;

  -- onboarding_completed_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organizations' 
      AND column_name = 'onboarding_completed_at'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN onboarding_completed_at TIMESTAMPTZ;
    RAISE NOTICE '✅ Coluna onboarding_completed_at criada';
  ELSE
    RAISE NOTICE 'ℹ️ Coluna onboarding_completed_at já existe';
  END IF;
END $$;

-- Adicionar comentários
COMMENT ON COLUMN public.organizations.business_type IS 'Tipo de negócio: products_and_services, products_only, services_only';
COMMENT ON COLUMN public.organizations.company_profile IS 'Perfil da empresa: MEI, ME, EIRELI, LTDA, etc.';
COMMENT ON COLUMN public.organizations.state IS 'Estado da organização';
COMMENT ON COLUMN public.organizations.city IS 'Cidade da organização';
COMMENT ON COLUMN public.organizations.tax_regime IS 'Regime tributário: MEI, ME, Simples Nacional, Lucro Presumido, Lucro Real';
COMMENT ON COLUMN public.organizations.expectations IS 'O que a empresa espera do sistema';
COMMENT ON COLUMN public.organizations.onboarding_completed IS 'Indica se o onboarding foi completado';
COMMENT ON COLUMN public.organizations.onboarding_completed_at IS 'Data e hora de conclusão do onboarding';

-- Verificar se a tabela organizations existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'organizations'
  ) THEN
    RAISE EXCEPTION 'ERRO: Tabela organizations não existe!';
  END IF;
END $$;

-- Verificação final
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


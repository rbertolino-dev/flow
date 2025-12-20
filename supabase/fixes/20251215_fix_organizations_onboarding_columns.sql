-- ============================================
-- FIX: Adicionar colunas de onboarding em organizations e forçar atualização do cache
-- Execute no Supabase SQL Editor
-- ============================================
-- Este script adiciona todas as colunas de onboarding e força o PostgREST a atualizar o schema cache

-- ============================================
-- 1. Adicionar todas as colunas de onboarding (usando ALTER TABLE direto)
-- ============================================
-- Usar ALTER TABLE direto (não dentro de DO $$) para forçar atualização do cache

ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS company_profile TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS tax_regime TEXT,
  ADD COLUMN IF NOT EXISTS expectations TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- ============================================
-- 2. Adicionar comentários
-- ============================================
COMMENT ON COLUMN public.organizations.business_type IS 'Tipo de negócio: products_and_services, products_only, services_only';
COMMENT ON COLUMN public.organizations.company_profile IS 'Perfil da empresa: MEI, ME, EIRELI, LTDA, etc.';
COMMENT ON COLUMN public.organizations.state IS 'Estado da organização';
COMMENT ON COLUMN public.organizations.city IS 'Cidade da organização';
COMMENT ON COLUMN public.organizations.tax_regime IS 'Regime tributário: MEI, ME, Simples Nacional, Lucro Presumido, Lucro Real';
COMMENT ON COLUMN public.organizations.expectations IS 'O que a empresa espera do sistema';
COMMENT ON COLUMN public.organizations.onboarding_completed IS 'Indica se o onboarding foi completado';
COMMENT ON COLUMN public.organizations.onboarding_completed_at IS 'Data e hora de conclusão do onboarding';

-- ============================================
-- 3. Forçar atualização do schema cache do PostgREST
-- ============================================
-- Múltiplas formas de forçar atualização do cache

-- Método 1: Notificar o PostgREST
NOTIFY pgrst, 'reload schema';

-- Método 2: Fazer uma query simples para forçar refresh
SELECT 1 FROM public.organizations LIMIT 1;

-- Método 3: Verificar se as colunas existem (força refresh do cache)
DO $$
BEGIN
  PERFORM column_name 
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'business_type';
END $$;

-- ============================================
-- 4. Verificar se todas as colunas foram criadas
-- ============================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'organizations'
  AND column_name IN (
    'business_type',
    'company_profile',
    'state',
    'city',
    'tax_regime',
    'expectations',
    'onboarding_completed',
    'onboarding_completed_at'
  )
ORDER BY column_name;

-- ============================================
-- 5. SOLUÇÃO ALTERNATIVA: Se o cache ainda não atualizar
-- ============================================
-- Se após executar este script o erro persistir, tente:

-- Opção A: Recriar a tabela (CUIDADO: só se não houver dados importantes)
-- DROP TABLE IF EXISTS public.organizations CASCADE;
-- (Depois recriar com todas as colunas)

-- Opção B: Aguardar 2-5 minutos (cache do PostgREST atualiza periodicamente)

-- Opção C: No Supabase Dashboard:
-- 1. Vá em Settings > API
-- 2. Clique em "Reload Schema" ou "Refresh Schema"
-- 3. Aguarde alguns segundos

-- Opção D: Verificar se as colunas realmente existem:
-- Execute: supabase/fixes/20251215_VERIFICAR_COLUNAS_ORGANIZATIONS.sql

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- IMPORTANTE: Após executar este script:
-- 1. Execute o script de verificação para confirmar que as colunas foram criadas
-- 2. Se as colunas existem mas o erro persiste, o problema é cache do PostgREST
-- 3. Aguarde 2-5 minutos OU use o Supabase Dashboard para forçar refresh do schema
-- 4. Recarregue a página do cadastro (F5 ou Ctrl+Shift+R)
-- 5. Se ainda der erro após 5 minutos, verifique no Dashboard se há opção "Reload Schema"


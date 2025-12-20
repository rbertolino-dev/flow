-- ============================================
-- MIGRAÇÃO: Adicionar campos de onboarding na tabela organizations
-- ============================================

-- Adicionar campos de onboarding na tabela organizations
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS company_profile TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS tax_regime TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS expectations TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Comentários para documentação
COMMENT ON COLUMN public.organizations.company_profile IS 'Perfil da empresa: MEI, ME, EIRELI, LTDA, etc.';
COMMENT ON COLUMN public.organizations.state IS 'Estado da organização';
COMMENT ON COLUMN public.organizations.city IS 'Cidade da organização';
COMMENT ON COLUMN public.organizations.tax_regime IS 'Regime tributário: MEI, ME, Simples Nacional, Lucro Presumido, Lucro Real';
COMMENT ON COLUMN public.organizations.business_type IS 'Tipo de negócio: products_and_services, products_only, services_only';
COMMENT ON COLUMN public.organizations.expectations IS 'O que a empresa espera do sistema';
COMMENT ON COLUMN public.organizations.onboarding_completed IS 'Indica se o onboarding foi completado';
COMMENT ON COLUMN public.organizations.onboarding_completed_at IS 'Data e hora de conclusão do onboarding';



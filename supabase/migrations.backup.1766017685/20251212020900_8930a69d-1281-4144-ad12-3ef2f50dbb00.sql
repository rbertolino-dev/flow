
-- Adicionar colunas de onboarding à tabela organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS company_profile TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS tax_regime TEXT,
ADD COLUMN IF NOT EXISTS business_type TEXT,
ADD COLUMN IF NOT EXISTS expectations TEXT,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

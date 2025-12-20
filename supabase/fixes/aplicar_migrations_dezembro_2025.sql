-- ============================================
-- APLICAR MIGRATIONS DE DEZEMBRO 2025
-- Execute no Supabase SQL Editor
-- ============================================
-- Estas são as migrations novas que realmente faltam
-- As antigas já foram aplicadas manualmente

-- ============================================
-- 1. Adicionar colunas de onboarding em organizations
-- ============================================
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS company_profile TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS tax_regime TEXT,
  ADD COLUMN IF NOT EXISTS expectations TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.organizations.business_type IS 'Tipo de negócio: products_and_services, products_only, services_only';
COMMENT ON COLUMN public.organizations.company_profile IS 'Perfil da empresa: MEI, ME, EIRELI, LTDA, etc.';
COMMENT ON COLUMN public.organizations.state IS 'Estado da organização';
COMMENT ON COLUMN public.organizations.city IS 'Cidade da organização';
COMMENT ON COLUMN public.organizations.tax_regime IS 'Regime tributário: MEI, ME, Simples Nacional, Lucro Presumido, Lucro Real';
COMMENT ON COLUMN public.organizations.expectations IS 'O que a empresa espera do sistema';
COMMENT ON COLUMN public.organizations.onboarding_completed IS 'Indica se o onboarding foi completado';
COMMENT ON COLUMN public.organizations.onboarding_completed_at IS 'Data e hora de conclusão do onboarding';

-- ============================================
-- 2. Adicionar api_key em assistant_config
-- ============================================
-- Criar tabela assistant_config se não existir
CREATE TABLE IF NOT EXISTS public.assistant_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    system_prompt TEXT,
    tone_of_voice TEXT DEFAULT 'profissional',
    rules TEXT,
    restrictions TEXT,
    examples TEXT,
    temperature NUMERIC DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 2000,
    model TEXT DEFAULT 'deepseek-chat',
    is_active BOOLEAN DEFAULT true,
    is_global BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(organization_id)
);

-- Adicionar coluna api_key
ALTER TABLE public.assistant_config
ADD COLUMN IF NOT EXISTS api_key TEXT;

CREATE INDEX IF NOT EXISTS idx_assistant_config_org ON public.assistant_config(organization_id);
CREATE INDEX IF NOT EXISTS idx_assistant_config_global ON public.assistant_config(is_global) WHERE is_global = true;
CREATE INDEX IF NOT EXISTS idx_assistant_config_active ON public.assistant_config(is_active) WHERE is_active = true;

ALTER TABLE public.assistant_config ENABLE ROW LEVEL SECURITY;

-- Policies simplificadas
DROP POLICY IF EXISTS "Users can view their org assistant config" ON public.assistant_config;
CREATE POLICY "Users can view their org assistant config"
ON public.assistant_config
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = assistant_config.organization_id
    AND om.user_id = auth.uid()
  )
  OR is_global = true
);

DROP POLICY IF EXISTS "Users can manage their org assistant config" ON public.assistant_config;
CREATE POLICY "Users can manage their org assistant config"
ON public.assistant_config
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = assistant_config.organization_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

-- ============================================
-- 3. Sistema de Contratos (versão simplificada)
-- ============================================
-- Tabela de templates de contratos
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  content text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  cover_page_url TEXT,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de contratos gerados
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  contract_number text NOT NULL UNIQUE,
  content text NOT NULL,
  pdf_url text,
  signed_pdf_url text,
  signature_token TEXT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'expired', 'cancelled')),
  expires_at timestamptz,
  signed_at timestamptz,
  sent_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de assinaturas
CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  signer_type text NOT NULL CHECK (signer_type IN ('user', 'client')),
  signer_name text NOT NULL,
  signature_data text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de configuração de storage
CREATE TABLE IF NOT EXISTS public.contract_storage_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  storage_type text NOT NULL CHECK (storage_type IN ('supabase', 'firebase', 's3', 'custom')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_contract_templates_org ON public.contract_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_org_status ON public.contracts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_lead ON public.contracts(lead_id);
CREATE INDEX IF NOT EXISTS idx_contracts_number ON public.contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_contracts_signature_token ON public.contracts(signature_token) WHERE signature_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract ON public.contract_signatures(contract_id);

-- RLS
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_storage_config ENABLE ROW LEVEL SECURITY;

-- Policies básicas para contract_templates
DROP POLICY IF EXISTS "Users can view templates from their organization" ON public.contract_templates;
CREATE POLICY "Users can view templates from their organization"
ON public.contract_templates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can manage templates in their organization" ON public.contract_templates;
CREATE POLICY "Users can manage templates in their organization"
ON public.contract_templates FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
);

-- Policies básicas para contracts
DROP POLICY IF EXISTS "Users can view contracts from their organization" ON public.contracts;
CREATE POLICY "Users can view contracts from their organization"
ON public.contracts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can manage contracts in their organization" ON public.contracts;
CREATE POLICY "Users can manage contracts in their organization"
ON public.contracts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
);

-- Policies básicas para contract_signatures
DROP POLICY IF EXISTS "Users can view signatures from their organization" ON public.contract_signatures;
CREATE POLICY "Users can view signatures from their organization"
ON public.contract_signatures FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_signatures.contract_id
      AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create signatures for contracts in their organization" ON public.contract_signatures;
CREATE POLICY "Users can create signatures for contracts in their organization"
ON public.contract_signatures FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_signatures.contract_id
      AND om.user_id = auth.uid()
  )
);

-- Função para gerar token de assinatura
CREATE OR REPLACE FUNCTION public.generate_contract_signature_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  token TEXT;
BEGIN
  token := encode(gen_random_bytes(16), 'hex');
  RETURN token;
END;
$$;

-- Função para gerar número de contrato
CREATE OR REPLACE FUNCTION generate_contract_number(p_org_id uuid)
RETURNS text AS $$
DECLARE
  v_org_prefix text;
  v_date_prefix text;
  v_sequence_num integer;
  v_contract_number text;
BEGIN
  SELECT COALESCE(
    UPPER(SUBSTRING(name FROM 1 FOR 3)),
    UPPER(SUBSTRING(id::text FROM 1 FOR 3))
  ) INTO v_org_prefix
  FROM public.organizations
  WHERE id = p_org_id;
  
  v_date_prefix := TO_CHAR(now(), 'YYYYMMDD');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(contract_number FROM '[0-9]+$') AS INTEGER)
  ), 0) + 1 INTO v_sequence_num
  FROM public.contracts
  WHERE organization_id = p_org_id
    AND contract_number LIKE v_org_prefix || '-' || v_date_prefix || '-%';
  
  v_contract_number := v_org_prefix || '-' || v_date_prefix || '-' || LPAD(v_sequence_num::text, 4, '0');
  
  RETURN v_contract_number;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_contract_templates_updated_at ON public.contract_templates;
CREATE TRIGGER update_contract_templates_updated_at BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contracts_updated_at ON public.contracts;
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FIM DAS MIGRATIONS DE DEZEMBRO 2025
-- ============================================
-- Após executar, recarregue o app e verifique se os erros diminuíram



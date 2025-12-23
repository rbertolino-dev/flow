-- Script combinado para aplicar as novas migrações
-- Este script pode ser executado diretamente no Supabase SQL Editor

-- ============================================
-- Migração 1: Adicionar campos de autenticação em contract_signatures
-- ============================================

-- Adicionar coluna user_agent (navegador/dispositivo usado)
ALTER TABLE public.contract_signatures
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Adicionar coluna device_info (informações do dispositivo em JSON)
ALTER TABLE public.contract_signatures
ADD COLUMN IF NOT EXISTS device_info JSONB;

-- Adicionar coluna geolocation (localização aproximada, opcional)
ALTER TABLE public.contract_signatures
ADD COLUMN IF NOT EXISTS geolocation JSONB;

-- Adicionar coluna validation_hash (hash SHA-256 para validação de integridade)
ALTER TABLE public.contract_signatures
ADD COLUMN IF NOT EXISTS validation_hash TEXT;

-- Adicionar coluna signed_ip_country (país do IP, opcional)
ALTER TABLE public.contract_signatures
ADD COLUMN IF NOT EXISTS signed_ip_country TEXT;

-- Criar índice para validation_hash para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_contract_signatures_validation_hash 
ON public.contract_signatures(validation_hash);

-- Comentários para documentação
COMMENT ON COLUMN public.contract_signatures.user_agent IS 'User Agent do navegador/dispositivo usado para assinar';
COMMENT ON COLUMN public.contract_signatures.device_info IS 'Informações adicionais do dispositivo em formato JSON';
COMMENT ON COLUMN public.contract_signatures.geolocation IS 'Localização aproximada do signatário (com consentimento)';
COMMENT ON COLUMN public.contract_signatures.validation_hash IS 'Hash SHA-256 para validação de integridade da assinatura';
COMMENT ON COLUMN public.contract_signatures.signed_ip_country IS 'País do IP de origem da assinatura';

-- ============================================
-- Migração 2: Adicionar whatsapp_message_template em contracts
-- ============================================

ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS whatsapp_message_template TEXT;

-- Comentário para documentação
COMMENT ON COLUMN public.contracts.whatsapp_message_template IS 'Template personalizado da mensagem WhatsApp. Variáveis disponíveis: {{nome}}, {{numero_contrato}}, {{link_assinatura}}';

-- ============================================
-- Migração 3: Criar sistema de Pesquisas (Surveys)
-- ============================================

-- Tabela de Pesquisas
CREATE TABLE IF NOT EXISTS public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'standard',
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  style jsonb NOT NULL DEFAULT '{
    "primaryColor": "#3b82f6",
    "secondaryColor": "#64748b",
    "backgroundColor": "#ffffff",
    "textColor": "#1e293b",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "16px",
    "borderRadius": "8px",
    "buttonStyle": "filled",
    "buttonColor": "#3b82f6",
    "buttonTextColor": "#ffffff",
    "inputBorderColor": "#e2e8f0",
    "inputFocusColor": "#3b82f6"
  }'::jsonb,
  success_message text DEFAULT 'Obrigado por participar da pesquisa!',
  redirect_url text,
  is_active boolean NOT NULL DEFAULT true,
  allow_multiple_responses boolean DEFAULT false,
  collect_respondent_info boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Índices para surveys
CREATE INDEX IF NOT EXISTS idx_surveys_org ON public.surveys(organization_id);
CREATE INDEX IF NOT EXISTS idx_surveys_active ON public.surveys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_surveys_type ON public.surveys(type);
CREATE INDEX IF NOT EXISTS idx_surveys_created_at ON public.surveys(created_at DESC);

-- RLS para surveys
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view surveys from their organization" ON public.surveys;
CREATE POLICY "Users can view surveys from their organization"
  ON public.surveys FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create surveys in their organization" ON public.surveys;
CREATE POLICY "Users can create surveys in their organization"
  ON public.surveys FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update surveys in their organization" ON public.surveys;
CREATE POLICY "Users can update surveys in their organization"
  ON public.surveys FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete surveys in their organization" ON public.surveys;
CREATE POLICY "Users can delete surveys in their organization"
  ON public.surveys FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Trigger para updated_at em surveys
CREATE OR REPLACE FUNCTION update_surveys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS surveys_updated_at ON public.surveys;
CREATE TRIGGER surveys_updated_at
  BEFORE UPDATE ON public.surveys
  FOR EACH ROW
  EXECUTE FUNCTION update_surveys_updated_at();

-- Tabela de Respostas de Pesquisas
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  respondent_name text,
  respondent_email text,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para survey_responses
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON public.survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_org ON public.survey_responses(organization_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_created_at ON public.survey_responses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_responses_email ON public.survey_responses(respondent_email) WHERE respondent_email IS NOT NULL;

-- RLS para survey_responses
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view survey responses from their organization" ON public.survey_responses;
CREATE POLICY "Users can view survey responses from their organization"
  ON public.survey_responses FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Anyone can insert survey responses (for public surveys)" ON public.survey_responses;
CREATE POLICY "Anyone can insert survey responses (for public surveys)"
  ON public.survey_responses FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.surveys
      WHERE surveys.id = survey_responses.survey_id
      AND surveys.is_active = true
      AND surveys.organization_id = survey_responses.organization_id
    )
  );

-- Comentários para documentação
COMMENT ON TABLE public.surveys IS 'Tabela de pesquisas criadas pelos usuários';
COMMENT ON TABLE public.survey_responses IS 'Tabela de respostas coletadas das pesquisas';
COMMENT ON COLUMN public.surveys.type IS 'Tipo de pesquisa: standard (completa) ou quick (rápida)';
COMMENT ON COLUMN public.surveys.allow_multiple_responses IS 'Permite que o mesmo respondente envie múltiplas respostas';
COMMENT ON COLUMN public.surveys.collect_respondent_info IS 'Se deve coletar nome e email do respondente';
COMMENT ON COLUMN public.survey_responses.responses IS 'JSON com as respostas: { field_id: value, field_id: value }';
COMMENT ON COLUMN public.survey_responses.metadata IS 'Metadados: IP, user_agent, referrer, etc';


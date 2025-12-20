-- Migration: Sistema de Pesquisas (Surveys)
-- Criar tabelas para pesquisas e respostas

-- ============================================
-- Tabela de Pesquisas
-- ============================================
CREATE TABLE IF NOT EXISTS public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'standard', -- 'standard' | 'quick'
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_surveys_org ON public.surveys(organization_id);
CREATE INDEX IF NOT EXISTS idx_surveys_active ON public.surveys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_surveys_type ON public.surveys(type);
CREATE INDEX IF NOT EXISTS idx_surveys_created_at ON public.surveys(created_at DESC);

-- RLS
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view surveys from their organization"
  ON public.surveys FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create surveys in their organization"
  ON public.surveys FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update surveys in their organization"
  ON public.surveys FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete surveys in their organization"
  ON public.surveys FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_surveys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER surveys_updated_at
  BEFORE UPDATE ON public.surveys
  FOR EACH ROW
  EXECUTE FUNCTION update_surveys_updated_at();

-- ============================================
-- Tabela de Respostas de Pesquisas
-- ============================================
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON public.survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_org ON public.survey_responses(organization_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_created_at ON public.survey_responses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_responses_email ON public.survey_responses(respondent_email) WHERE respondent_email IS NOT NULL;

-- RLS
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view survey responses from their organization"
  ON public.survey_responses FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert survey responses (for public surveys)"
  ON public.survey_responses FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
    OR
    -- Permitir inserção pública se a pesquisa estiver ativa
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


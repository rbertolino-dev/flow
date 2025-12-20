-- Script para aplicar migration de Surveys diretamente
-- Execute este script no Supabase SQL Editor

-- ============================================
-- Tabela de Pesquisas
-- ============================================
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_surveys_org ON public.surveys(organization_id);
CREATE INDEX IF NOT EXISTS idx_surveys_active ON public.surveys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_surveys_type ON public.surveys(type);
CREATE INDEX IF NOT EXISTS idx_surveys_created_at ON public.surveys(created_at DESC);

-- RLS
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

-- Trigger para updated_at
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

-- Adicionar campos de expiração e encerramento
ALTER TABLE public.surveys
ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.surveys
ADD COLUMN IF NOT EXISTS is_closed boolean NOT NULL DEFAULT false;

ALTER TABLE public.surveys
ADD COLUMN IF NOT EXISTS public_slug text;

-- Criar índice único para public_slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_surveys_public_slug ON public.surveys(public_slug) WHERE public_slug IS NOT NULL;

-- Função para gerar slug único
CREATE OR REPLACE FUNCTION generate_survey_slug()
RETURNS text AS $$
DECLARE
  slug text;
  exists_check boolean;
BEGIN
  LOOP
    -- Gerar slug aleatório (8 caracteres alfanuméricos)
    slug := lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    
    -- Verificar se já existe
    SELECT EXISTS(SELECT 1 FROM public.surveys WHERE public_slug = slug) INTO exists_check;
    
    -- Se não existe, retornar
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN slug;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar slug automaticamente ao criar pesquisa
CREATE OR REPLACE FUNCTION set_survey_public_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_slug IS NULL OR NEW.public_slug = '' THEN
    NEW.public_slug := generate_survey_slug();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_survey_public_slug ON public.surveys;
CREATE TRIGGER trigger_set_survey_public_slug
  BEFORE INSERT ON public.surveys
  FOR EACH ROW
  EXECUTE FUNCTION set_survey_public_slug();

-- Gerar slugs para pesquisas existentes que não têm
UPDATE public.surveys
SET public_slug = generate_survey_slug()
WHERE public_slug IS NULL OR public_slug = '';

-- Comentários para documentação
COMMENT ON TABLE public.surveys IS 'Tabela de pesquisas criadas pelos usuários';
COMMENT ON TABLE public.survey_responses IS 'Tabela de respostas coletadas das pesquisas';
COMMENT ON COLUMN public.surveys.type IS 'Tipo de pesquisa: standard (completa) ou quick (rápida)';
COMMENT ON COLUMN public.surveys.allow_multiple_responses IS 'Permite que o mesmo respondente envie múltiplas respostas';
COMMENT ON COLUMN public.surveys.collect_respondent_info IS 'Se deve coletar nome e email do respondente';
COMMENT ON COLUMN public.surveys.expires_at IS 'Data de expiração da pesquisa (opcional). Após esta data, a pesquisa não aceita mais respostas.';
COMMENT ON COLUMN public.surveys.is_closed IS 'Indica se a pesquisa foi encerrada manualmente pelo usuário';
COMMENT ON COLUMN public.surveys.public_slug IS 'Slug único para acesso público à pesquisa via URL /survey/:slug';
COMMENT ON COLUMN public.survey_responses.responses IS 'JSON com as respostas: { field_id: value, field_id: value }';
COMMENT ON COLUMN public.survey_responses.metadata IS 'Metadados: IP, user_agent, referrer, etc';

-- Registrar a migration manualmente (se necessário)
INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
VALUES ('20250131000007', 'create_surveys', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
VALUES ('20250131000008', 'add_survey_expiration', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;



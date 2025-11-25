-- ============================================
-- MIGRAÇÃO: Tabelas calendar_message_templates e form_builders
-- ============================================

-- Tabela de templates de mensagem para calendário
CREATE TABLE IF NOT EXISTS public.calendar_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_calendar_message_templates_org 
  ON public.calendar_message_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_calendar_message_templates_active 
  ON public.calendar_message_templates(organization_id, is_active);

-- RLS
ALTER TABLE public.calendar_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org templates"
  ON public.calendar_message_templates FOR SELECT
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can insert their org templates"
  ON public.calendar_message_templates FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can update their org templates"
  ON public.calendar_message_templates FOR UPDATE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can delete their org templates"
  ON public.calendar_message_templates FOR DELETE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_calendar_message_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calendar_message_templates_updated_at
  BEFORE UPDATE ON public.calendar_message_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_message_templates_updated_at();

-- Tabela de construtores de formulário
CREATE TABLE IF NOT EXISTS public.form_builders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  style JSONB NOT NULL DEFAULT '{}'::jsonb,
  success_message TEXT NOT NULL DEFAULT 'Obrigado! Seus dados foram enviados com sucesso.',
  redirect_url TEXT,
  stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_form_builders_org 
  ON public.form_builders(organization_id);
CREATE INDEX IF NOT EXISTS idx_form_builders_active 
  ON public.form_builders(organization_id, is_active);

-- RLS
ALTER TABLE public.form_builders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org forms"
  ON public.form_builders FOR SELECT
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can insert their org forms"
  ON public.form_builders FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can update their org forms"
  ON public.form_builders FOR UPDATE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can delete their org forms"
  ON public.form_builders FOR DELETE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_form_builders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_form_builders_updated_at
  BEFORE UPDATE ON public.form_builders
  FOR EACH ROW
  EXECUTE FUNCTION update_form_builders_updated_at();
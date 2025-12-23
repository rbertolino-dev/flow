-- Criar tabela de templates de follow-up
CREATE TABLE IF NOT EXISTS public.follow_up_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_template_name_per_org UNIQUE(organization_id, name)
);

-- Criar tabela de etapas de template
CREATE TABLE IF NOT EXISTS public.follow_up_template_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.follow_up_templates(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  tip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_step_order_per_template UNIQUE(template_id, step_order)
);

-- Criar tabela de automações de etapa
CREATE TABLE IF NOT EXISTS public.follow_up_step_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES public.follow_up_template_steps(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('send_whatsapp', 'add_tag', 'move_stage', 'add_note', 'add_to_call_queue', 'update_field')),
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  execution_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Criar tabela de follow-ups aplicados a leads
CREATE TABLE IF NOT EXISTS public.lead_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.follow_up_templates(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Criar tabela de conclusões de etapas
CREATE TABLE IF NOT EXISTS public.lead_follow_up_step_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id UUID NOT NULL REFERENCES public.lead_follow_ups(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.follow_up_template_steps(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_by UUID NOT NULL REFERENCES auth.users(id),
  CONSTRAINT unique_completion_per_step UNIQUE(follow_up_id, step_id)
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_follow_up_templates_org ON public.follow_up_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_template_steps_template ON public.follow_up_template_steps(template_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_step_automations_step ON public.follow_up_step_automations(step_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_lead ON public.lead_follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_template ON public.lead_follow_ups(template_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_up_completions_followup ON public.lead_follow_up_step_completions(follow_up_id);

-- Trigger para updated_at em follow_up_templates
CREATE OR REPLACE FUNCTION update_follow_up_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_follow_up_templates_updated_at
  BEFORE UPDATE ON public.follow_up_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_up_templates_updated_at();

-- RLS Policies para follow_up_templates
ALTER TABLE public.follow_up_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view templates from their org"
  ON public.follow_up_templates FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can create templates in their org"
  ON public.follow_up_templates FOR INSERT
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can update templates in their org"
  ON public.follow_up_templates FOR UPDATE
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can delete templates in their org"
  ON public.follow_up_templates FOR DELETE
  USING (organization_id = get_user_organization(auth.uid()));

-- RLS Policies para follow_up_template_steps
ALTER TABLE public.follow_up_template_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view steps from their org templates"
  ON public.follow_up_template_steps FOR SELECT
  USING (template_id IN (
    SELECT id FROM public.follow_up_templates 
    WHERE organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can create steps in their org templates"
  ON public.follow_up_template_steps FOR INSERT
  WITH CHECK (template_id IN (
    SELECT id FROM public.follow_up_templates 
    WHERE organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can update steps in their org templates"
  ON public.follow_up_template_steps FOR UPDATE
  USING (template_id IN (
    SELECT id FROM public.follow_up_templates 
    WHERE organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can delete steps in their org templates"
  ON public.follow_up_template_steps FOR DELETE
  USING (template_id IN (
    SELECT id FROM public.follow_up_templates 
    WHERE organization_id = get_user_organization(auth.uid())
  ));

-- RLS Policies para follow_up_step_automations
ALTER TABLE public.follow_up_step_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automations from their org"
  ON public.follow_up_step_automations FOR SELECT
  USING (step_id IN (
    SELECT s.id FROM public.follow_up_template_steps s
    JOIN public.follow_up_templates t ON t.id = s.template_id
    WHERE t.organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can create automations in their org"
  ON public.follow_up_step_automations FOR INSERT
  WITH CHECK (step_id IN (
    SELECT s.id FROM public.follow_up_template_steps s
    JOIN public.follow_up_templates t ON t.id = s.template_id
    WHERE t.organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can update automations in their org"
  ON public.follow_up_step_automations FOR UPDATE
  USING (step_id IN (
    SELECT s.id FROM public.follow_up_template_steps s
    JOIN public.follow_up_templates t ON t.id = s.template_id
    WHERE t.organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can delete automations in their org"
  ON public.follow_up_step_automations FOR DELETE
  USING (step_id IN (
    SELECT s.id FROM public.follow_up_template_steps s
    JOIN public.follow_up_templates t ON t.id = s.template_id
    WHERE t.organization_id = get_user_organization(auth.uid())
  ));

-- RLS Policies para lead_follow_ups
ALTER TABLE public.lead_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view follow-ups from their org leads"
  ON public.lead_follow_ups FOR SELECT
  USING (lead_id IN (
    SELECT id FROM public.leads 
    WHERE organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can create follow-ups for their org leads"
  ON public.lead_follow_ups FOR INSERT
  WITH CHECK (lead_id IN (
    SELECT id FROM public.leads 
    WHERE organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can update follow-ups from their org leads"
  ON public.lead_follow_ups FOR UPDATE
  USING (lead_id IN (
    SELECT id FROM public.leads 
    WHERE organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can delete follow-ups from their org leads"
  ON public.lead_follow_ups FOR DELETE
  USING (lead_id IN (
    SELECT id FROM public.leads 
    WHERE organization_id = get_user_organization(auth.uid())
  ));

-- RLS Policies para lead_follow_up_step_completions
ALTER TABLE public.lead_follow_up_step_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view completions from their org"
  ON public.lead_follow_up_step_completions FOR SELECT
  USING (follow_up_id IN (
    SELECT fu.id FROM public.lead_follow_ups fu
    JOIN public.leads l ON l.id = fu.lead_id
    WHERE l.organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can create completions in their org"
  ON public.lead_follow_up_step_completions FOR INSERT
  WITH CHECK (follow_up_id IN (
    SELECT fu.id FROM public.lead_follow_ups fu
    JOIN public.leads l ON l.id = fu.lead_id
    WHERE l.organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can delete completions in their org"
  ON public.lead_follow_up_step_completions FOR DELETE
  USING (follow_up_id IN (
    SELECT fu.id FROM public.lead_follow_ups fu
    JOIN public.leads l ON l.id = fu.lead_id
    WHERE l.organization_id = get_user_organization(auth.uid())
  ));
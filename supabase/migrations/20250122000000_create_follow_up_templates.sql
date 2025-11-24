-- Migração: Sistema de Templates de Follow-up
-- Permite criar processos padrão de abordagem para leads

-- Tabela de templates de follow-up
CREATE TABLE IF NOT EXISTS public.follow_up_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de etapas do template
CREATE TABLE IF NOT EXISTS public.follow_up_template_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.follow_up_templates(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  tip TEXT, -- Dica ou exemplo para a etapa
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de follow-ups aplicados aos leads (instância do template)
CREATE TABLE IF NOT EXISTS public.lead_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.follow_up_templates(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid()
);

-- Tabela de conclusão de etapas do follow-up
CREATE TABLE IF NOT EXISTS public.lead_follow_up_step_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id UUID NOT NULL REFERENCES public.lead_follow_ups(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.follow_up_template_steps(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid(),
  UNIQUE(follow_up_id, step_id) -- Garantir que cada etapa só seja marcada uma vez
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_follow_up_templates_org ON public.follow_up_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_template_steps_template ON public.follow_up_template_steps(template_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_template_steps_order ON public.follow_up_template_steps(template_id, step_order);
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_lead ON public.lead_follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_template ON public.lead_follow_ups(template_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_up_completions_followup ON public.lead_follow_up_step_completions(follow_up_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_up_completions_step ON public.lead_follow_up_step_completions(step_id);

-- Habilitar RLS
ALTER TABLE public.follow_up_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_template_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_follow_up_step_completions ENABLE ROW LEVEL SECURITY;

-- Policies para follow_up_templates
CREATE POLICY "Follow-up templates: members can select"
  ON public.follow_up_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = follow_up_templates.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), follow_up_templates.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Follow-up templates: members can insert"
  ON public.follow_up_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = follow_up_templates.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), follow_up_templates.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Follow-up templates: members can update"
  ON public.follow_up_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = follow_up_templates.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), follow_up_templates.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Follow-up templates: members can delete"
  ON public.follow_up_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = follow_up_templates.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), follow_up_templates.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Policies para follow_up_template_steps (herda acesso do template)
CREATE POLICY "Follow-up template steps: members can select"
  ON public.follow_up_template_steps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE ft.id = follow_up_template_steps.template_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      WHERE ft.id = follow_up_template_steps.template_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

CREATE POLICY "Follow-up template steps: members can insert"
  ON public.follow_up_template_steps
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE ft.id = follow_up_template_steps.template_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      WHERE ft.id = follow_up_template_steps.template_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

CREATE POLICY "Follow-up template steps: members can update"
  ON public.follow_up_template_steps
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE ft.id = follow_up_template_steps.template_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      WHERE ft.id = follow_up_template_steps.template_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

CREATE POLICY "Follow-up template steps: members can delete"
  ON public.follow_up_template_steps
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE ft.id = follow_up_template_steps.template_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      WHERE ft.id = follow_up_template_steps.template_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

-- Policies para lead_follow_ups
CREATE POLICY "Lead follow-ups: members can select"
  ON public.lead_follow_ups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.leads l
      JOIN public.organization_members om ON om.organization_id = l.organization_id
      WHERE l.id = lead_follow_ups.lead_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = lead_follow_ups.lead_id
        AND (public.user_is_org_admin(auth.uid(), l.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

CREATE POLICY "Lead follow-ups: members can insert"
  ON public.lead_follow_ups
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.leads l
      JOIN public.organization_members om ON om.organization_id = l.organization_id
      WHERE l.id = lead_follow_ups.lead_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = lead_follow_ups.lead_id
        AND (public.user_is_org_admin(auth.uid(), l.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

CREATE POLICY "Lead follow-ups: members can update"
  ON public.lead_follow_ups
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.leads l
      JOIN public.organization_members om ON om.organization_id = l.organization_id
      WHERE l.id = lead_follow_ups.lead_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = lead_follow_ups.lead_id
        AND (public.user_is_org_admin(auth.uid(), l.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

CREATE POLICY "Lead follow-ups: members can delete"
  ON public.lead_follow_ups
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.leads l
      JOIN public.organization_members om ON om.organization_id = l.organization_id
      WHERE l.id = lead_follow_ups.lead_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = lead_follow_ups.lead_id
        AND (public.user_is_org_admin(auth.uid(), l.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

-- Policies para lead_follow_up_step_completions
CREATE POLICY "Lead follow-up step completions: members can select"
  ON public.lead_follow_up_step_completions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.lead_follow_ups lfu
      JOIN public.leads l ON l.id = lfu.lead_id
      JOIN public.organization_members om ON om.organization_id = l.organization_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.lead_follow_ups lfu
      JOIN public.leads l ON l.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND (public.user_is_org_admin(auth.uid(), l.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

CREATE POLICY "Lead follow-up step completions: members can insert"
  ON public.lead_follow_up_step_completions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lead_follow_ups lfu
      JOIN public.leads l ON l.id = lfu.lead_id
      JOIN public.organization_members om ON om.organization_id = l.organization_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.lead_follow_ups lfu
      JOIN public.leads l ON l.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND (public.user_is_org_admin(auth.uid(), l.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

CREATE POLICY "Lead follow-up step completions: members can update"
  ON public.lead_follow_up_step_completions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.lead_follow_ups lfu
      JOIN public.leads l ON l.id = lfu.lead_id
      JOIN public.organization_members om ON om.organization_id = l.organization_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.lead_follow_ups lfu
      JOIN public.leads l ON l.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND (public.user_is_org_admin(auth.uid(), l.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

CREATE POLICY "Lead follow-up step completions: members can delete"
  ON public.lead_follow_up_step_completions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.lead_follow_ups lfu
      JOIN public.leads l ON l.id = lfu.lead_id
      JOIN public.organization_members om ON om.organization_id = l.organization_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.lead_follow_ups lfu
      JOIN public.leads l ON l.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND (public.user_is_org_admin(auth.uid(), l.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

-- Comentários explicativos
COMMENT ON TABLE public.follow_up_templates IS 'Templates de processos de follow-up que podem ser aplicados aos leads';
COMMENT ON TABLE public.follow_up_template_steps IS 'Etapas individuais de um template de follow-up';
COMMENT ON TABLE public.lead_follow_ups IS 'Instâncias de templates de follow-up aplicados a leads específicos';
COMMENT ON TABLE public.lead_follow_up_step_completions IS 'Registro de conclusão de etapas individuais do follow-up de um lead';


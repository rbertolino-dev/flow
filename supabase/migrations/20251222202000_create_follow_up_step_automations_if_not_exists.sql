-- =====================================================
-- FIX: Criar tabela follow_up_step_automations se não existir
-- =====================================================
-- O problema: Tabela follow_up_step_automations não existe no banco
-- Solução: Criar tabela com estrutura completa e políticas RLS

-- Tabela de automações das etapas
CREATE TABLE IF NOT EXISTS public.follow_up_step_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES public.follow_up_template_steps(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'send_whatsapp',
    'send_whatsapp_template',
    'add_tag',
    'remove_tag',
    'move_stage',
    'add_note',
    'add_to_call_queue',
    'remove_from_call_queue',
    'update_field',
    'update_value',
    'apply_template',
    'wait_delay',
    'create_reminder'
  )),
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  execution_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_follow_up_step_automations_step ON public.follow_up_step_automations(step_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_step_automations_order ON public.follow_up_step_automations(step_id, execution_order);

-- Habilitar RLS
ALTER TABLE public.follow_up_step_automations ENABLE ROW LEVEL SECURITY;

-- Drop policies existentes se houver
DROP POLICY IF EXISTS "Follow-up step automations: members can select" ON public.follow_up_step_automations;
DROP POLICY IF EXISTS "Follow-up step automations: members can insert" ON public.follow_up_step_automations;
DROP POLICY IF EXISTS "Follow-up step automations: members can update" ON public.follow_up_step_automations;
DROP POLICY IF EXISTS "Follow-up step automations: members can delete" ON public.follow_up_step_automations;
DROP POLICY IF EXISTS "Users can view automations from their steps" ON public.follow_up_step_automations;
DROP POLICY IF EXISTS "Users can create automations in their steps" ON public.follow_up_step_automations;
DROP POLICY IF EXISTS "Users can update automations in their steps" ON public.follow_up_step_automations;
DROP POLICY IF EXISTS "Users can delete automations from their steps" ON public.follow_up_step_automations;

-- Policies para follow_up_step_automations (herda acesso do step/template)
CREATE POLICY "Follow-up step automations: members can select"
  ON public.follow_up_step_automations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.follow_up_template_steps fts
      JOIN public.follow_up_templates ft ON ft.id = fts.template_id
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE fts.id = follow_up_step_automations.step_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_template_steps fts
      JOIN public.follow_up_templates ft ON ft.id = fts.template_id
      WHERE fts.id = follow_up_step_automations.step_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

CREATE POLICY "Follow-up step automations: members can insert"
  ON public.follow_up_step_automations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.follow_up_template_steps fts
      JOIN public.follow_up_templates ft ON ft.id = fts.template_id
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE fts.id = follow_up_step_automations.step_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_template_steps fts
      JOIN public.follow_up_templates ft ON ft.id = fts.template_id
      WHERE fts.id = follow_up_step_automations.step_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

CREATE POLICY "Follow-up step automations: members can update"
  ON public.follow_up_step_automations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.follow_up_template_steps fts
      JOIN public.follow_up_templates ft ON ft.id = fts.template_id
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE fts.id = follow_up_step_automations.step_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_template_steps fts
      JOIN public.follow_up_templates ft ON ft.id = fts.template_id
      WHERE fts.id = follow_up_step_automations.step_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

CREATE POLICY "Follow-up step automations: members can delete"
  ON public.follow_up_step_automations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.follow_up_template_steps fts
      JOIN public.follow_up_templates ft ON ft.id = fts.template_id
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE fts.id = follow_up_step_automations.step_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_template_steps fts
      JOIN public.follow_up_templates ft ON ft.id = fts.template_id
      WHERE fts.id = follow_up_step_automations.step_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

-- Comentário explicativo
COMMENT ON TABLE public.follow_up_step_automations IS 'Automações que são executadas quando uma etapa de follow-up é marcada como concluída';
COMMENT ON COLUMN public.follow_up_step_automations.action_config IS 'JSON com configuração específica da ação. Exemplos: {"message": "texto", "instance_id": "uuid"} para send_whatsapp, {"tag_id": "uuid"} para add_tag, {"stage_id": "uuid"} para move_stage';


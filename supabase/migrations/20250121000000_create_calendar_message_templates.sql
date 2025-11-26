-- Migração: Templates de mensagem para eventos do calendário

-- Tabela para armazenar templates de mensagem específicos para agenda
CREATE TABLE IF NOT EXISTS public.calendar_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  template text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para buscar templates por organização
CREATE INDEX IF NOT EXISTS idx_calendar_message_templates_org
  ON public.calendar_message_templates (organization_id);

-- RLS Policies
ALTER TABLE public.calendar_message_templates ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver templates da sua organização
CREATE POLICY "Users can view templates from their organization"
  ON public.calendar_message_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = calendar_message_templates.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Política: Usuários podem criar templates na sua organização
CREATE POLICY "Users can create templates in their organization"
  ON public.calendar_message_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = calendar_message_templates.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Política: Usuários podem atualizar templates da sua organização
CREATE POLICY "Users can update templates from their organization"
  ON public.calendar_message_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = calendar_message_templates.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Política: Usuários podem deletar templates da sua organização
CREATE POLICY "Users can delete templates from their organization"
  ON public.calendar_message_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = calendar_message_templates.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Comentários
COMMENT ON TABLE public.calendar_message_templates IS 'Templates de mensagem para eventos do calendário';
COMMENT ON COLUMN public.calendar_message_templates.template IS 'Template com variáveis: {nome}, {telefone}, {data}, {hora}, {link_meet}';





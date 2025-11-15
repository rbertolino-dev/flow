-- Migração: Tabela de grupos de WhatsApp para workflows
-- Registra apenas grupos selecionados/usados (registro inteligente para reduzir custos)

CREATE TABLE IF NOT EXISTS public.whatsapp_workflow_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id text NOT NULL, -- ID do grupo na Evolution API
  group_name text NOT NULL,
  instance_id uuid NOT NULL REFERENCES public.evolution_config(id) ON DELETE CASCADE,
  participant_count integer, -- Número de participantes (opcional, para referência)
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice único: um grupo só pode ser registrado uma vez por organização/instância
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_workflow_groups_unique
  ON public.whatsapp_workflow_groups (organization_id, group_id, instance_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_groups_org
  ON public.whatsapp_workflow_groups (organization_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_groups_instance
  ON public.whatsapp_workflow_groups (instance_id);

ALTER TABLE public.whatsapp_workflow_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies para multi-empresa
CREATE POLICY "Workflow groups: members can select"
  ON public.whatsapp_workflow_groups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_groups.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_groups.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Workflow groups: members can insert"
  ON public.whatsapp_workflow_groups
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_groups.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_groups.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Workflow groups: members can update"
  ON public.whatsapp_workflow_groups
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_groups.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_groups.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Workflow groups: admins can delete"
  ON public.whatsapp_workflow_groups
  FOR DELETE
  USING (
    public.user_is_org_admin(auth.uid(), whatsapp_workflow_groups.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_whatsapp_workflow_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_whatsapp_workflow_groups_updated_at
  BEFORE UPDATE ON public.whatsapp_workflow_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_whatsapp_workflow_groups_updated_at();


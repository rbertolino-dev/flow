-- ============================================
-- MIGRAÇÃO COMPLETA: Grupos e Anexos por Mês
-- Aplicar no Supabase Dashboard > SQL Editor
-- ============================================

-- ============================================
-- MIGRAÇÃO 1: Tabela de grupos de WhatsApp
-- ============================================

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

-- ============================================
-- MIGRAÇÃO 2: Anexos por mês de cobrança
-- ============================================

-- Adicionar campo month_reference na tabela de anexos por contato
ALTER TABLE public.whatsapp_workflow_contact_attachments
  ADD COLUMN IF NOT EXISTS month_reference text;

-- Remover constraint UNIQUE antiga (workflow_id, lead_id, contact_phone)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'whatsapp_workflow_contact_attachments_workflow_id_lead_id_contact_phone_key'
  ) THEN
    ALTER TABLE public.whatsapp_workflow_contact_attachments
      DROP CONSTRAINT whatsapp_workflow_contact_attachments_workflow_id_lead_id_contact_phone_key;
  END IF;
END $$;

-- Criar novo índice UNIQUE incluindo month_reference
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_workflow_contact_attachments_unique
  ON public.whatsapp_workflow_contact_attachments (
    workflow_id, 
    lead_id, 
    contact_phone, 
    COALESCE(month_reference, '')
  );

-- Índice para busca por mês de referência
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_contact_attachments_month
  ON public.whatsapp_workflow_contact_attachments (workflow_id, lead_id, month_reference)
  WHERE month_reference IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.whatsapp_workflow_contact_attachments.month_reference IS 
  'Referência do mês no formato MM/YYYY (ex: 01/2025). Permite múltiplos anexos por contato, um por mês. NULL para anexos gerais (não específicos de mês).';

-- ============================================
-- MIGRAÇÃO 3: Suporte a grupos em workflows
-- ============================================

-- Adicionar campo recipient_type
ALTER TABLE public.whatsapp_workflows
  ADD COLUMN IF NOT EXISTS recipient_type text NOT NULL DEFAULT 'list'
    CHECK (recipient_type IN ('list', 'single', 'group'));

-- Adicionar campo group_id
ALTER TABLE public.whatsapp_workflows
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.whatsapp_workflow_groups(id) ON DELETE SET NULL;

-- Índice para busca por grupo
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_group
  ON public.whatsapp_workflows (group_id)
  WHERE group_id IS NOT NULL;

-- Índice para busca por tipo de destinatário
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_recipient_type
  ON public.whatsapp_workflows (recipient_type);

-- Migrar dados existentes
UPDATE public.whatsapp_workflows
SET recipient_type = CASE 
  WHEN recipient_mode = 'single' THEN 'single'
  ELSE 'list'
END
WHERE recipient_type = 'list' AND recipient_mode IS NOT NULL;

-- Comentários explicativos
COMMENT ON COLUMN public.whatsapp_workflows.recipient_type IS 
  'Tipo de destinatário: list (lista de contatos), single (contato único), group (grupo de WhatsApp)';
COMMENT ON COLUMN public.whatsapp_workflows.group_id IS 
  'ID do grupo de WhatsApp (quando recipient_type = group). Referência para whatsapp_workflow_groups.';

-- ============================================
-- FIM DAS MIGRAÇÕES
-- ============================================


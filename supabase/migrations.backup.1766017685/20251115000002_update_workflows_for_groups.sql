-- Migração: Adicionar suporte a grupos como destinatários em workflows

-- Adicionar campo recipient_type (substitui/enriquece recipient_mode)
ALTER TABLE public.whatsapp_workflows
  ADD COLUMN IF NOT EXISTS recipient_type text NOT NULL DEFAULT 'list'
    CHECK (recipient_type IN ('list', 'single', 'group'));

-- Adicionar campo group_id (FK para whatsapp_workflow_groups)
ALTER TABLE public.whatsapp_workflows
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.whatsapp_workflow_groups(id) ON DELETE SET NULL;

-- Índice para busca por grupo
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_group
  ON public.whatsapp_workflows (group_id)
  WHERE group_id IS NOT NULL;

-- Índice para busca por tipo de destinatário
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_recipient_type
  ON public.whatsapp_workflows (recipient_type);

-- Migrar dados existentes: se recipient_mode = 'single', recipient_type = 'single', senão 'list'
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


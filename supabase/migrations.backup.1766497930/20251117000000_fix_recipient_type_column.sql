-- ============================================
-- CORREÇÃO: Adicionar coluna recipient_type
-- Esta migração será aplicada automaticamente pelo Lovable
-- ============================================

-- Adicionar campo recipient_type (se não existir)
ALTER TABLE public.whatsapp_workflows
  ADD COLUMN IF NOT EXISTS recipient_type text DEFAULT 'list'
    CHECK (recipient_type IN ('list', 'single', 'group'));

-- Atualizar valores existentes antes de tornar NOT NULL
UPDATE public.whatsapp_workflows
SET recipient_type = CASE 
  WHEN recipient_mode = 'single' THEN 'single'
  ELSE 'list'
END
WHERE recipient_type IS NULL;

-- Tornar NOT NULL após garantir valores
DO $$
BEGIN
  -- Verificar se ainda há valores NULL (caso não tenha recipient_mode)
  UPDATE public.whatsapp_workflows
  SET recipient_type = 'list'
  WHERE recipient_type IS NULL;
  
  -- Agora tornar NOT NULL
  ALTER TABLE public.whatsapp_workflows
    ALTER COLUMN recipient_type SET NOT NULL,
    ALTER COLUMN recipient_type SET DEFAULT 'list';
END $$;

-- Adicionar campo group_id (se não existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_workflow_groups') THEN
    ALTER TABLE public.whatsapp_workflows
      ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.whatsapp_workflow_groups(id) ON DELETE SET NULL;
  ELSE
    -- Se a tabela não existir, criar coluna sem foreign key por enquanto
    ALTER TABLE public.whatsapp_workflows
      ADD COLUMN IF NOT EXISTS group_id uuid;
  END IF;
END $$;

-- Índice para busca por grupo
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_group
  ON public.whatsapp_workflows (group_id)
  WHERE group_id IS NOT NULL;

-- Índice para busca por tipo de destinatário
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_recipient_type
  ON public.whatsapp_workflows (recipient_type);

-- Comentários explicativos
COMMENT ON COLUMN public.whatsapp_workflows.recipient_type IS 
  'Tipo de destinatário: list (lista de contatos), single (contato único), group (grupo de WhatsApp)';
COMMENT ON COLUMN public.whatsapp_workflows.group_id IS 
  'ID do grupo de WhatsApp (quando recipient_type = group). Referência para whatsapp_workflow_groups.';


-- Migração: Permitir workflow_list_id NULL para workflows de grupo
-- Quando recipient_mode = 'group', workflow_list_id deve ser NULL

-- Remover constraint NOT NULL da coluna workflow_list_id
ALTER TABLE public.whatsapp_workflows
  ALTER COLUMN workflow_list_id DROP NOT NULL;

-- Adicionar constraint CHECK para garantir que:
-- - Se recipient_mode = 'group', então workflow_list_id deve ser NULL
-- - Se recipient_mode != 'group', então workflow_list_id não deve ser NULL
ALTER TABLE public.whatsapp_workflows
  DROP CONSTRAINT IF EXISTS whatsapp_workflows_workflow_list_id_check;

ALTER TABLE public.whatsapp_workflows
  ADD CONSTRAINT whatsapp_workflows_workflow_list_id_check
  CHECK (
    (recipient_mode = 'group' AND workflow_list_id IS NULL)
    OR
    (recipient_mode != 'group' AND workflow_list_id IS NOT NULL)
  );

-- Comentário explicativo
COMMENT ON COLUMN public.whatsapp_workflows.workflow_list_id IS 
  'ID da lista de contatos (obrigatório para list e single, NULL para group)';


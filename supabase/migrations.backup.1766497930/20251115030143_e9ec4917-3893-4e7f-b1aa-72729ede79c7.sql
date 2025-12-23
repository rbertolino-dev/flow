-- Adicionar coluna group_id na tabela whatsapp_workflows
ALTER TABLE public.whatsapp_workflows 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.whatsapp_workflow_groups(id) ON DELETE SET NULL;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_group_id 
ON public.whatsapp_workflows(group_id);

-- Recarregar schema cache
NOTIFY pgrst, 'reload schema';
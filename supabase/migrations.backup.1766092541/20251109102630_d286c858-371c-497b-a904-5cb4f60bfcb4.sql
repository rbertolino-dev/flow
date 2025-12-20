-- Permitir exclusão de evolution_config sem comprometer outras tabelas
-- Remover constraints antigos e recriar com CASCADE/SET NULL

-- Leads: ao deletar uma instância, apenas limpar a referência (SET NULL)
ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS leads_source_instance_id_fkey;

ALTER TABLE public.leads
ADD CONSTRAINT leads_source_instance_id_fkey 
FOREIGN KEY (source_instance_id) 
REFERENCES public.evolution_config(id) 
ON DELETE SET NULL;

-- Broadcast campaigns: ao deletar uma instância, também deletar as campanhas relacionadas (CASCADE)
ALTER TABLE public.broadcast_campaigns
DROP CONSTRAINT IF EXISTS broadcast_campaigns_instance_id_fkey;

ALTER TABLE public.broadcast_campaigns
ADD CONSTRAINT broadcast_campaigns_instance_id_fkey 
FOREIGN KEY (instance_id) 
REFERENCES public.evolution_config(id) 
ON DELETE CASCADE;

-- Scheduled messages: ao deletar uma instância, também deletar as mensagens agendadas (CASCADE)
ALTER TABLE public.scheduled_messages
DROP CONSTRAINT IF EXISTS scheduled_messages_instance_id_fkey CASCADE;

ALTER TABLE public.scheduled_messages
ADD CONSTRAINT scheduled_messages_instance_id_fkey 
FOREIGN KEY (instance_id) 
REFERENCES public.evolution_config(id) 
ON DELETE CASCADE;
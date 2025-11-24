-- Adicionar campo para controlar criação de leads no Chatwoot
ALTER TABLE public.chatwoot_configs
ADD COLUMN IF NOT EXISTS create_leads BOOLEAN DEFAULT true;

-- Comentário explicativo
COMMENT ON COLUMN public.chatwoot_configs.create_leads IS 'Se true, cria leads no funil quando recebe mensagens. Se false, apenas processa mensagens sem criar leads.';


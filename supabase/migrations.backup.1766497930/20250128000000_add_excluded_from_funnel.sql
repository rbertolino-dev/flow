-- Adicionar campo excluded_from_funnel na tabela leads
-- Este campo marca contatos que não devem aparecer no funil de vendas (ex: funcionários)
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS excluded_from_funnel BOOLEAN NOT NULL DEFAULT false;

-- Criar índice para melhor performance nas consultas filtradas
CREATE INDEX IF NOT EXISTS idx_leads_excluded_from_funnel ON public.leads(organization_id, excluded_from_funnel) 
WHERE excluded_from_funnel = true;

-- Comentário explicativo
COMMENT ON COLUMN public.leads.excluded_from_funnel IS 'Marca contatos que não devem aparecer no funil de vendas (ex: funcionários, contatos internos)';


-- Adicionar coluna return_date na tabela leads se não existir
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS return_date TIMESTAMP WITH TIME ZONE;

-- Criar índice para melhorar performance das buscas por data de retorno
CREATE INDEX IF NOT EXISTS idx_leads_return_date 
  ON public.leads(return_date) 
  WHERE return_date IS NOT NULL;

-- Comentário na coluna
COMMENT ON COLUMN public.leads.return_date IS 'Data de retorno agendada para o lead';


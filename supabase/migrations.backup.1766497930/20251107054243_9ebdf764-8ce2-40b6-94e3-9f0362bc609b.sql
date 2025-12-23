-- Adicionar campos de data de retorno e instância de origem na tabela leads
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS return_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS source_instance_id UUID REFERENCES public.evolution_config(id);

-- Criar índice para melhorar performance das buscas
CREATE INDEX IF NOT EXISTS idx_leads_return_date 
  ON public.leads(return_date) 
  WHERE return_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_source_instance 
  ON public.leads(source_instance_id) 
  WHERE source_instance_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_created_at 
  ON public.leads(created_at);
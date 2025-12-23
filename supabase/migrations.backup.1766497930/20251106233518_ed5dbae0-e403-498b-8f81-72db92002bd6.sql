-- Adicionar colunas necessárias à tabela leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_stage_id ON public.leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON public.leads(deleted_at);

-- Backfill: setar stage_id para a primeira etapa (posição 0) de cada usuário
UPDATE public.leads
SET stage_id = (
  SELECT ps.id 
  FROM public.pipeline_stages ps 
  WHERE ps.user_id = leads.user_id 
  ORDER BY ps.position ASC 
  LIMIT 1
)
WHERE stage_id IS NULL;

-- Adicionar tabelas ao realtime (se ainda não estiverem)
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_stages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tags;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_tags;
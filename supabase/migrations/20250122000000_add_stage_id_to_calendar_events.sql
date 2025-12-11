-- Adicionar campo stage_id (etiqueta do funil) na tabela calendar_events
ALTER TABLE public.calendar_events
ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL;

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_stage_id
  ON public.calendar_events(stage_id)
  WHERE stage_id IS NOT NULL;

-- Comentário
COMMENT ON COLUMN public.calendar_events.stage_id IS 'Etiqueta/etapa do funil associada à reunião';



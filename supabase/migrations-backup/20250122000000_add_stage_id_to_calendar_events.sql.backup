-- Adicionar campo stage_id (etiqueta do funil) na tabela calendar_events
-- Nota: pipeline_stages será criada em migration posterior
-- Esta migration será aplicada depois que pipeline_stages existir
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pipeline_stages') THEN
    ALTER TABLE public.calendar_events
    ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Criar índice para melhorar performance (apenas se coluna existir)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calendar_events' AND column_name = 'stage_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_calendar_events_stage_id
      ON public.calendar_events(stage_id)
      WHERE stage_id IS NOT NULL;
  END IF;
END $$;

-- Comentário (apenas se coluna existir)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calendar_events' AND column_name = 'stage_id'
  ) THEN
    COMMENT ON COLUMN public.calendar_events.stage_id IS 'Etiqueta/etapa do funil associada à reunião';
  END IF;
END $$;




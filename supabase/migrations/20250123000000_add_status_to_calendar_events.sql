-- Adicionar status aos eventos do calendário
ALTER TABLE public.calendar_events
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show'));

-- Adicionar data de conclusão
ALTER TABLE public.calendar_events
ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Adicionar notas sobre a reunião
ALTER TABLE public.calendar_events
ADD COLUMN IF NOT EXISTS completion_notes text;

-- Índice para buscar eventos por status
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON public.calendar_events(status);

-- Índice para buscar eventos completados
CREATE INDEX IF NOT EXISTS idx_calendar_events_completed ON public.calendar_events(completed_at) WHERE status = 'completed';


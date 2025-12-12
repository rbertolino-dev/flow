-- Adicionar campos de convidados e organizador aos eventos
ALTER TABLE public.calendar_events
ADD COLUMN IF NOT EXISTS organizer_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS attendees jsonb DEFAULT '[]'::jsonb;

-- Índice para buscar eventos por organizador
CREATE INDEX IF NOT EXISTS idx_calendar_events_organizer ON public.calendar_events(organizer_user_id);

-- Comentários
COMMENT ON COLUMN public.calendar_events.organizer_user_id IS 'Usuário responsável pela reunião';
COMMENT ON COLUMN public.calendar_events.attendees IS 'Lista de convidados em formato JSON: [{"email": "email@example.com", "displayName": "Nome"}]';



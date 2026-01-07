-- Migration: Adicionar campo para rastrear quem marcou a reunião
-- Este campo é diferente de organizer_user_id (quem criou o evento)
-- booked_by_user_id = quem conseguiu marcar/agendar a reunião

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS booked_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Índice para buscar eventos por quem marcou
CREATE INDEX IF NOT EXISTS idx_calendar_events_booked_by 
  ON public.calendar_events(booked_by_user_id)
  WHERE booked_by_user_id IS NOT NULL;

-- Comentário
COMMENT ON COLUMN public.calendar_events.booked_by_user_id IS 'Usuário que marcou/agendou a reunião (pode ser diferente do organizador)';


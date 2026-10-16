-- Persiste a cor do evento do Google Calendar (colorId 1–11) para relatórios de agendamento.
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS color_id text;

CREATE INDEX IF NOT EXISTS idx_calendar_events_color_id
  ON public.calendar_events (organization_id, color_id);

COMMENT ON COLUMN public.calendar_events.color_id IS
  'Google Calendar colorId (1–11). Null = cor padrão da agenda.';

-- Força uma leitura completa na próxima sync para preencher color_id nos eventos já espelhados.
UPDATE public.google_calendar_configs
SET sync_token = NULL
WHERE is_active = true;

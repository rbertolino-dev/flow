-- IDs do evento Google Agenda na OS + default Agenda Agilize = true
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS google_calendar_config_id UUID NULL
    REFERENCES public.google_calendar_configs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT NULL;

ALTER TABLE public.service_orders
  ALTER COLUMN add_to_agilize_calendar SET DEFAULT true;

COMMENT ON COLUMN public.service_orders.google_calendar_config_id IS
  'Conta Google Calendar usada no sync da OS';
COMMENT ON COLUMN public.service_orders.google_calendar_event_id IS
  'ID do evento no Google Calendar (google_event_id)';

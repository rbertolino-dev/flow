-- Agenda precisa estar na publicação realtime para a tela atualizar
-- sem depender só do botão de sincronizar.

ALTER TABLE public.calendar_events REPLICA IDENTITY FULL;
ALTER TABLE public.google_calendar_configs REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'calendar_events'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'google_calendar_configs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.google_calendar_configs;
    END IF;
  END IF;
END $$;

-- Migração: Configuração de integração Google Calendar por organização

-- Tabela para armazenar configurações de contas do Google Calendar
CREATE TABLE IF NOT EXISTS public.google_calendar_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  refresh_token text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para buscar configurações por organização
CREATE INDEX IF NOT EXISTS idx_google_calendar_configs_org
  ON public.google_calendar_configs (organization_id);

-- Tabela para cache de eventos do Google Calendar
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  google_calendar_config_id uuid NOT NULL REFERENCES public.google_calendar_configs(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  summary text,
  description text,
  start_datetime timestamptz NOT NULL,
  end_datetime timestamptz NOT NULL,
  location text,
  html_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(google_calendar_config_id, google_event_id)
);

-- Índices para calendar_events
CREATE INDEX IF NOT EXISTS idx_calendar_events_org
  ON public.calendar_events (organization_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_config
  ON public.calendar_events (google_calendar_config_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_dates
  ON public.calendar_events (start_datetime, end_datetime);

-- Habilitar RLS
ALTER TABLE public.google_calendar_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Policies para google_calendar_configs
CREATE POLICY "Google Calendar config: members can select"
  ON public.google_calendar_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_calendar_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_calendar_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Google Calendar config: members can insert"
  ON public.google_calendar_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_calendar_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_calendar_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Google Calendar config: members can update"
  ON public.google_calendar_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_calendar_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_calendar_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Google Calendar config: members can delete"
  ON public.google_calendar_configs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_calendar_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_calendar_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Policies para calendar_events
CREATE POLICY "Calendar events: members can select"
  ON public.calendar_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = calendar_events.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), calendar_events.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Calendar events: members can insert"
  ON public.calendar_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = calendar_events.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), calendar_events.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Calendar events: members can update"
  ON public.calendar_events
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = calendar_events.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), calendar_events.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Calendar events: members can delete"
  ON public.calendar_events
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = calendar_events.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), calendar_events.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION public.update_google_calendar_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_google_calendar_configs_updated_at
  BEFORE UPDATE ON public.google_calendar_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_google_calendar_configs_updated_at();

CREATE OR REPLACE FUNCTION public.update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_calendar_events_updated_at();


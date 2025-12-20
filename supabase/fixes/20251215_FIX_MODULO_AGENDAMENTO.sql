-- ============================================
-- FIX: Verificar e corrigir módulo de agendamento
-- Execute no Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Verificar/Criar tabela scheduled_messages
-- ============================================
CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  instance_id UUID NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video', 'document')),
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar organization_id se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'scheduled_messages' 
      AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.scheduled_messages 
    ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Índices para scheduled_messages
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_user_status 
  ON public.scheduled_messages(user_id, status);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_for 
  ON public.scheduled_messages(scheduled_for) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_organization_id 
  ON public.scheduled_messages(organization_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_lead_id 
  ON public.scheduled_messages(lead_id);

-- RLS para scheduled_messages
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (atualizadas para usar organization_id)
DROP POLICY IF EXISTS "Users can view their own scheduled messages" ON public.scheduled_messages;
CREATE POLICY "Users can view scheduled messages from their org"
  ON public.scheduled_messages
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
    OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Users can create their own scheduled messages" ON public.scheduled_messages;
CREATE POLICY "Users can create scheduled messages in their org"
  ON public.scheduled_messages
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
    AND auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Users can update their own scheduled messages" ON public.scheduled_messages;
CREATE POLICY "Users can update scheduled messages in their org"
  ON public.scheduled_messages
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
    OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Users can delete their own scheduled messages" ON public.scheduled_messages;
CREATE POLICY "Users can delete scheduled messages in their org"
  ON public.scheduled_messages
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
    OR auth.uid() = user_id
  );

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_scheduled_messages_updated_at ON public.scheduled_messages;
CREATE TRIGGER update_scheduled_messages_updated_at
  BEFORE UPDATE ON public.scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 2. Verificar/Criar tabela calendar_events
-- ============================================
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

-- Adicionar colunas opcionais se não existirem
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_notes text,
  ADD COLUMN IF NOT EXISTS organizer_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attendees jsonb DEFAULT '[]'::jsonb;

-- Índices para calendar_events
CREATE INDEX IF NOT EXISTS idx_calendar_events_org
  ON public.calendar_events (organization_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_config
  ON public.calendar_events (google_calendar_config_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_dates
  ON public.calendar_events (start_datetime, end_datetime);

CREATE INDEX IF NOT EXISTS idx_calendar_events_stage_id
  ON public.calendar_events(stage_id)
  WHERE stage_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_status 
  ON public.calendar_events(status);

CREATE INDEX IF NOT EXISTS idx_calendar_events_completed 
  ON public.calendar_events(completed_at) 
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_calendar_events_organizer 
  ON public.calendar_events(organizer_user_id);

-- RLS para calendar_events
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Calendar events: members can select" ON public.calendar_events;
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
  );

DROP POLICY IF EXISTS "Calendar events: members can insert" ON public.calendar_events;
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
  );

DROP POLICY IF EXISTS "Calendar events: members can update" ON public.calendar_events;
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
  );

DROP POLICY IF EXISTS "Calendar events: members can delete" ON public.calendar_events;
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
  );

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_calendar_events_updated_at ON public.calendar_events;
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

-- ============================================
-- 3. Verificar/Criar tabela google_calendar_configs
-- ============================================
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

-- Índice para google_calendar_configs
CREATE INDEX IF NOT EXISTS idx_google_calendar_configs_org
  ON public.google_calendar_configs (organization_id);

-- RLS para google_calendar_configs
ALTER TABLE public.google_calendar_configs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Google Calendar config: members can select" ON public.google_calendar_configs;
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
  );

DROP POLICY IF EXISTS "Google Calendar config: members can insert" ON public.google_calendar_configs;
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
  );

DROP POLICY IF EXISTS "Google Calendar config: members can update" ON public.google_calendar_configs;
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
  );

DROP POLICY IF EXISTS "Google Calendar config: members can delete" ON public.google_calendar_configs;
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
  );

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_google_calendar_configs_updated_at ON public.google_calendar_configs;
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

-- ============================================
-- 4. Verificar/Criar tabela calendar_message_templates
-- ============================================
CREATE TABLE IF NOT EXISTS public.calendar_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  template text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para calendar_message_templates
CREATE INDEX IF NOT EXISTS idx_calendar_message_templates_org
  ON public.calendar_message_templates (organization_id);

-- RLS para calendar_message_templates
ALTER TABLE public.calendar_message_templates ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Users can view templates from their organization" ON public.calendar_message_templates;
CREATE POLICY "Users can view templates from their organization"
  ON public.calendar_message_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = calendar_message_templates.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create templates in their organization" ON public.calendar_message_templates;
CREATE POLICY "Users can create templates in their organization"
  ON public.calendar_message_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = calendar_message_templates.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update templates from their organization" ON public.calendar_message_templates;
CREATE POLICY "Users can update templates from their organization"
  ON public.calendar_message_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = calendar_message_templates.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete templates from their organization" ON public.calendar_message_templates;
CREATE POLICY "Users can delete templates from their organization"
  ON public.calendar_message_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = calendar_message_templates.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_calendar_message_templates_updated_at ON public.calendar_message_templates;
CREATE TRIGGER trigger_calendar_message_templates_updated_at
  BEFORE UPDATE ON public.calendar_message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 5. Forçar refresh do cache PostgREST
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- 6. Verificar resultado
-- ============================================
SELECT 
  'scheduled_messages' as tabela,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'scheduled_messages'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'scheduled_messages' 
      AND column_name = 'organization_id'
  ) THEN '✅ organization_id OK' ELSE '❌ organization_id faltando' END as organization_id
UNION ALL
SELECT 
  'calendar_events',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'calendar_events'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'calendar_events' 
      AND column_name = 'status'
  ) THEN '✅ Colunas OK' ELSE '❌ Colunas faltando' END
UNION ALL
SELECT 
  'google_calendar_configs',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'google_calendar_configs'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  '✅ OK'
UNION ALL
SELECT 
  'calendar_message_templates',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'calendar_message_templates'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  '✅ OK';

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Aguarde 30-60 segundos após executar para o PostgREST atualizar o cache
-- Depois recarregue a página (F5)


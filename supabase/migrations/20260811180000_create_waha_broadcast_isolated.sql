-- ============================================================
-- Disparador WAHA - estrutura 100% isolada da Evolution
-- ============================================================

CREATE TABLE IF NOT EXISTS public.waha_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  session_name TEXT NOT NULL,
  display_name TEXT,
  phone_number TEXT,
  api_url TEXT NOT NULL DEFAULT 'https://waha.ordemservico.com',
  engine TEXT NOT NULL DEFAULT 'GOWS',
  status TEXT NOT NULL DEFAULT 'STOPPED',
  is_connected BOOLEAN NOT NULL DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT waha_config_status_check
    CHECK (status IN ('STARTING', 'SCAN_QR_CODE', 'WORKING', 'FAILED', 'STOPPED')),
  CONSTRAINT waha_config_org_session_unique UNIQUE (organization_id, session_name)
);

CREATE TABLE IF NOT EXISTS public.broadcast_campaigns_waha (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  custom_message TEXT NOT NULL,
  sending_method TEXT NOT NULL DEFAULT 'single',
  session_id UUID REFERENCES public.waha_config(id) ON DELETE SET NULL,
  session_ids UUID[] NOT NULL DEFAULT '{}',
  min_delay_seconds INTEGER NOT NULL DEFAULT 30,
  max_delay_seconds INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'draft',
  total_contacts INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  cancelled_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT broadcast_campaigns_waha_method_check
    CHECK (sending_method IN ('single', 'rotate', 'separate')),
  CONSTRAINT broadcast_campaigns_waha_status_check
    CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled')),
  CONSTRAINT broadcast_campaigns_waha_delay_check
    CHECK (
      min_delay_seconds >= 5
      AND max_delay_seconds >= min_delay_seconds
      AND max_delay_seconds <= 3600
    )
);

CREATE TABLE IF NOT EXISTS public.broadcast_queue_waha (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.broadcast_campaigns_waha(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.waha_config(id) ON DELETE RESTRICT,
  phone TEXT NOT NULL,
  chat_id TEXT,
  name TEXT,
  personalized_message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  failure_code TEXT,
  response_message_id TEXT,
  send_attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  processing_lock_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT broadcast_queue_waha_status_check
    CHECK (status IN ('pending', 'scheduled', 'sent', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_waha_config_org
  ON public.waha_config (organization_id);
CREATE INDEX IF NOT EXISTS idx_waha_config_connected
  ON public.waha_config (organization_id, is_connected);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_waha_org
  ON public.broadcast_campaigns_waha (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_waha_status
  ON public.broadcast_campaigns_waha (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_waha_due
  ON public.broadcast_queue_waha (scheduled_for, created_at)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_waha_campaign
  ON public.broadcast_queue_waha (campaign_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcast_queue_waha_unique_active
  ON public.broadcast_queue_waha (campaign_id, phone, session_id)
  WHERE status IN ('pending', 'scheduled');

ALTER TABLE public.waha_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_campaigns_waha ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_queue_waha ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waha_config_org_access" ON public.waha_config;
CREATE POLICY "waha_config_org_access"
ON public.waha_config FOR ALL
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

DROP POLICY IF EXISTS "broadcast_campaigns_waha_org_access"
  ON public.broadcast_campaigns_waha;
CREATE POLICY "broadcast_campaigns_waha_org_access"
ON public.broadcast_campaigns_waha FOR ALL
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

DROP POLICY IF EXISTS "broadcast_queue_waha_org_access"
  ON public.broadcast_queue_waha;
CREATE POLICY "broadcast_queue_waha_org_access"
ON public.broadcast_queue_waha FOR ALL
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

COMMENT ON TABLE public.waha_config IS
  'Sessões WAHA por organização; credenciais ficam apenas nos secrets das Edge Functions.';
COMMENT ON TABLE public.broadcast_campaigns_waha IS
  'Campanhas do disparador WAHA, isoladas de broadcast_campaigns_2.';
COMMENT ON TABLE public.broadcast_queue_waha IS
  'Fila do disparador WAHA, isolada de broadcast_queue_2.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime
        ADD TABLE public.broadcast_queue_waha;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END
$$;

-- Cron independente. A função é pública apenas para execução técnica e usa
-- service role internamente; não recebe segredos no request.
DO $$
DECLARE
  existing_job BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    SELECT jobid INTO existing_job
    FROM cron.job
    WHERE jobname = 'process-broadcast-queue-waha'
    LIMIT 1;

    IF existing_job IS NOT NULL THEN
      PERFORM cron.unschedule(existing_job);
    END IF;

    PERFORM cron.schedule(
      'process-broadcast-queue-waha',
      '* * * * *',
      $cron$
        SELECT net.http_post(
          url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-broadcast-queue-waha',
          headers := '{"Content-Type":"application/json"}'::jsonb,
          body := '{}'::jsonb
        );
      $cron$
    );
  END IF;
END
$$;

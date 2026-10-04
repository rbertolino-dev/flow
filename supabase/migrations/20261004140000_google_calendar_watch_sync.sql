-- Espelhamento da agenda: token incremental, trava por conta e canal de aviso do Google.
-- Agenda parada não entra em varredura de eventos.

ALTER TABLE public.google_calendar_configs
  ADD COLUMN IF NOT EXISTS sync_token text,
  ADD COLUMN IF NOT EXISTS sync_lock_until timestamptz,
  ADD COLUMN IF NOT EXISTS watch_channel_id text,
  ADD COLUMN IF NOT EXISTS watch_resource_id text,
  ADD COLUMN IF NOT EXISTS watch_expiration timestamptz,
  ADD COLUMN IF NOT EXISTS idle_since timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_calendar_configs_watch_channel
  ON public.google_calendar_configs (watch_channel_id)
  WHERE watch_channel_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.try_lock_google_calendar_sync(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_id uuid;
BEGIN
  UPDATE public.google_calendar_configs
  SET sync_lock_until = now() + interval '2 minutes'
  WHERE id = p_id
    AND (sync_lock_until IS NULL OR sync_lock_until < now())
  RETURNING id INTO updated_id;

  RETURN updated_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.google_calendars_needing_watch(p_limit integer)
RETURNS TABLE (
  id uuid,
  watch_expiration timestamptz,
  sync_token text,
  channel_missing boolean,
  channel_expired boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.watch_expiration,
    c.sync_token,
    c.watch_expiration IS NULL AS channel_missing,
    c.watch_expiration IS NOT NULL AND c.watch_expiration < now() AS channel_expired
  FROM public.google_calendar_configs c
  WHERE c.is_active = true
    AND (c.watch_expiration IS NULL OR c.watch_expiration < now() + interval '1 day')
  ORDER BY c.watch_expiration NULLS FIRST
  LIMIT GREATEST(p_limit, 1);
$$;

REVOKE ALL ON FUNCTION public.try_lock_google_calendar_sync(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.google_calendars_needing_watch(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_lock_google_calendar_sync(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_calendars_needing_watch(integer) TO service_role;

-- Renova só o canal de aviso. Não lista eventos de agenda parada.
DO $$
DECLARE
  existing_job bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    SELECT jobid INTO existing_job
    FROM cron.job
    WHERE jobname = 'renew-google-calendar-watches'
    LIMIT 1;

    IF existing_job IS NOT NULL THEN
      PERFORM cron.unschedule(existing_job);
    END IF;

    PERFORM cron.schedule(
      'renew-google-calendar-watches',
      '0 */6 * * *',
      $cron$
        SELECT net.http_post(
          url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/renew-google-calendar-watches',
          headers := '{"Content-Type":"application/json"}'::jsonb,
          body := '{}'::jsonb
        );
      $cron$
    );
  END IF;
END
$$;

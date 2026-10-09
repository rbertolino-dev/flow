-- Auto-reconnect silencioso: campos de tentativa nos alertas ops + snapshot

ALTER TABLE public.platform_connection_alerts
  ADD COLUMN IF NOT EXISTS last_auto_reconnect_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_reconnect_result text;

COMMENT ON COLUMN public.platform_connection_alerts.last_auto_reconnect_at IS
  'Última tentativa de auto-reconnect silencioso (sem QR).';
COMMENT ON COLUMN public.platform_connection_alerts.auto_reconnect_result IS
  'Resultado da última tentativa: restored | needs_scan | error';

ALTER TABLE public.platform_connection_alerts
  DROP CONSTRAINT IF EXISTS platform_connection_alerts_auto_reconnect_result_check;

ALTER TABLE public.platform_connection_alerts
  ADD CONSTRAINT platform_connection_alerts_auto_reconnect_result_check
  CHECK (
    auto_reconnect_result IS NULL
    OR auto_reconnect_result IN ('restored', 'needs_scan', 'error')
  );

DROP FUNCTION IF EXISTS public.get_platform_whatsapp_connection_snapshot();

CREATE OR REPLACE FUNCTION public.get_platform_whatsapp_connection_snapshot()
RETURNS TABLE(
  evolution_config_id uuid,
  organization_id uuid,
  organization_name text,
  instance_name text,
  api_url text,
  is_connected boolean,
  phone_number text,
  updated_at timestamptz,
  last_disconnect_at timestamptz,
  last_reconnect_at timestamptz,
  open_alert_id uuid,
  open_alert_detected_at timestamptz,
  open_alert_acknowledged_at timestamptz,
  open_alert_last_auto_reconnect_at timestamptz,
  open_alert_auto_reconnect_result text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id AS evolution_config_id,
    c.organization_id,
    o.name::text AS organization_name,
    c.instance_name::text AS instance_name,
    c.api_url::text AS api_url,
    c.is_connected,
    c.phone_number::text AS phone_number,
    c.updated_at,
    (
      SELECT e.occurred_at
      FROM public.instance_connection_events e
      WHERE e.instance_id = c.id
        AND e.event_kind = 'disconnect'
      ORDER BY e.occurred_at DESC
      LIMIT 1
    ) AS last_disconnect_at,
    (
      SELECT e.occurred_at
      FROM public.instance_connection_events e
      WHERE e.instance_id = c.id
        AND e.event_kind = 'reconnect'
      ORDER BY e.occurred_at DESC
      LIMIT 1
    ) AS last_reconnect_at,
    a.id AS open_alert_id,
    a.detected_at AS open_alert_detected_at,
    a.acknowledged_at AS open_alert_acknowledged_at,
    a.last_auto_reconnect_at AS open_alert_last_auto_reconnect_at,
    a.auto_reconnect_result::text AS open_alert_auto_reconnect_result
  FROM public.evolution_config c
  LEFT JOIN public.organizations o ON o.id = c.organization_id
  LEFT JOIN LATERAL (
    SELECT
      al.id,
      al.detected_at,
      al.acknowledged_at,
      al.last_auto_reconnect_at,
      al.auto_reconnect_result
    FROM public.platform_connection_alerts al
    WHERE al.evolution_config_id = c.id
      AND al.resolved_at IS NULL
    ORDER BY al.detected_at DESC
    LIMIT 1
  ) a ON true
  ORDER BY
    (c.is_connected IS TRUE) ASC,
    o.name ASC NULLS LAST,
    c.instance_name ASC;
END;
$$;

COMMENT ON FUNCTION public.get_platform_whatsapp_connection_snapshot() IS
  'Super Admin: snapshot de conexão WhatsApp de todas as orgs (com status auto-reconnect, sem QR).';

GRANT EXECUTE ON FUNCTION public.get_platform_whatsapp_connection_snapshot() TO authenticated;

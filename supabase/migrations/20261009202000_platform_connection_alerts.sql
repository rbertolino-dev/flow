-- Alertas ops de desconexão WhatsApp (todas as orgs) — sem QR Code

CREATE TABLE IF NOT EXISTS public.platform_connection_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  organization_name text,
  evolution_config_id uuid NOT NULL REFERENCES public.evolution_config(id) ON DELETE CASCADE,
  instance_name text NOT NULL,
  provider_api_url text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_connection_alerts_open
  ON public.platform_connection_alerts (detected_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_connection_alerts_config
  ON public.platform_connection_alerts (evolution_config_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_connection_alerts_org
  ON public.platform_connection_alerts (organization_id, detected_at DESC);

COMMENT ON TABLE public.platform_connection_alerts IS
  'Alertas de desconexão WhatsApp para ops (todas as orgs). Sem QR Code.';

ALTER TABLE public.platform_connection_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_connection_alerts_select_admin" ON public.platform_connection_alerts;
CREATE POLICY "platform_connection_alerts_select_admin"
  ON public.platform_connection_alerts FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "platform_connection_alerts_update_admin" ON public.platform_connection_alerts;
CREATE POLICY "platform_connection_alerts_update_admin"
  ON public.platform_connection_alerts FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Snapshot global: instâncias + último evento de desconexão/reconexão
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
  open_alert_acknowledged_at timestamptz
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
    a.acknowledged_at AS open_alert_acknowledged_at
  FROM public.evolution_config c
  LEFT JOIN public.organizations o ON o.id = c.organization_id
  LEFT JOIN LATERAL (
    SELECT al.id, al.detected_at, al.acknowledged_at
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
  'Super Admin: snapshot de conexão WhatsApp de todas as orgs (sem QR).';

GRANT EXECUTE ON FUNCTION public.get_platform_whatsapp_connection_snapshot() TO authenticated;

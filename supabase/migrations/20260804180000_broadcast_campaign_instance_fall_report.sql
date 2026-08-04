-- Relatório por campanha: instâncias que caíram e quantos disparos fizeram até desconectar
CREATE OR REPLACE FUNCTION public.get_broadcast_campaign_instance_fall_report(p_campaign_id uuid)
RETURNS TABLE (
  instance_id uuid,
  instance_name text,
  sent_count bigint,
  failed_count bigint,
  disconnect_fail_count bigint,
  pending_or_scheduled_count bigint,
  first_disconnect_at timestamptz,
  last_sent_at timestamptz,
  sent_before_disconnect bigint,
  fell boolean,
  sample_disconnect_error text,
  is_connected boolean
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT c.organization_id INTO v_org
  FROM public.broadcast_campaigns_2 c
  WHERE c.id = p_campaign_id;

  IF v_org IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    public.user_belongs_to_org(auth.uid(), v_org)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH queue_rows AS (
    SELECT
      q.instance_id AS iid,
      q.status,
      q.sent_at,
      q.failed_at,
      q.last_attempt_at,
      q.error_message,
      q.failure_code,
      (
        q.status = 'failed'
        AND (
          COALESCE(q.failure_code, '') IN ('INSTANCE_UNAVAILABLE', 'CONNECTION_CLOSED')
          OR COALESCE(q.error_message, '') ~* '(desconect|connection closed|connectionstate|precondition required|sess[aã]o.*(fech|closed)|chip.*(off|caiu)|falso positivo)'
        )
      ) AS is_disconnect_fail
    FROM public.broadcast_queue_2 q
    WHERE q.campaign_id = p_campaign_id
      AND q.instance_id IS NOT NULL
  ),
  per_instance AS (
    SELECT
      r.iid,
      COUNT(*) FILTER (WHERE r.status = 'sent')::bigint AS sent_count,
      COUNT(*) FILTER (WHERE r.status = 'failed')::bigint AS failed_count,
      COUNT(*) FILTER (WHERE r.is_disconnect_fail)::bigint AS disconnect_fail_count,
      COUNT(*) FILTER (WHERE r.status IN ('pending', 'scheduled'))::bigint AS pending_or_scheduled_count,
      MIN(COALESCE(r.failed_at, r.last_attempt_at)) FILTER (WHERE r.is_disconnect_fail) AS first_disconnect_at,
      MAX(r.sent_at) FILTER (WHERE r.status = 'sent') AS last_sent_at,
      (array_agg(r.error_message ORDER BY COALESCE(r.failed_at, r.last_attempt_at) ASC NULLS LAST)
        FILTER (WHERE r.is_disconnect_fail AND r.error_message IS NOT NULL))[1] AS sample_disconnect_error
    FROM queue_rows r
    GROUP BY r.iid
  ),
  sent_before AS (
    SELECT
      p.iid,
      CASE
        WHEN p.first_disconnect_at IS NULL THEN p.sent_count
        ELSE (
          SELECT COUNT(*)::bigint
          FROM public.broadcast_queue_2 q2
          WHERE q2.campaign_id = p_campaign_id
            AND q2.instance_id = p.iid
            AND q2.status = 'sent'
            AND q2.sent_at IS NOT NULL
            AND q2.sent_at <= p.first_disconnect_at
        )
      END AS sent_before_disconnect
    FROM per_instance p
  )
  SELECT
    p.iid AS instance_id,
    COALESCE(ec.instance_name, 'Instância removida')::text AS instance_name,
    p.sent_count,
    p.failed_count,
    p.disconnect_fail_count,
    p.pending_or_scheduled_count,
    p.first_disconnect_at,
    p.last_sent_at,
    sb.sent_before_disconnect,
    (p.disconnect_fail_count > 0)::boolean AS fell,
    LEFT(COALESCE(p.sample_disconnect_error, ''), 280)::text AS sample_disconnect_error,
    COALESCE(ec.is_connected, false) AS is_connected
  FROM per_instance p
  JOIN sent_before sb ON sb.iid = p.iid
  LEFT JOIN public.evolution_config ec ON ec.id = p.iid
  ORDER BY
    (p.disconnect_fail_count > 0) DESC,
    sb.sent_before_disconnect DESC,
    p.sent_count DESC,
    COALESCE(ec.instance_name, '') ASC;
END;
$$;

COMMENT ON FUNCTION public.get_broadcast_campaign_instance_fall_report(uuid) IS
  'Por campanha (v2): enviados/falhas por instância, se caiu (desconexão) e quantos disparos até a 1ª queda.';

GRANT EXECUTE ON FUNCTION public.get_broadcast_campaign_instance_fall_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_broadcast_campaign_instance_fall_report(uuid) TO service_role;

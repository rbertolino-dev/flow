-- Ranking de desconexoes/reconexoes por instancia (chip) no periodo.

CREATE OR REPLACE FUNCTION public.get_org_instance_disconnection_ranking(
  p_organization_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE(
  instance_id uuid,
  instance_name text,
  disconnects bigint,
  reconnects bigint
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
    public.user_belongs_to_org(auth.uid(), p_organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id AS instance_id,
    c.instance_name::text AS instance_name,
    COALESCE(
      SUM(
        CASE WHEN e.event_kind = 'disconnect' THEN 1 ELSE 0 END
      ),
      0
    )::bigint AS disconnects,
    COALESCE(
      SUM(
        CASE WHEN e.event_kind = 'reconnect' THEN 1 ELSE 0 END
      ),
      0
    )::bigint AS reconnects
  FROM public.evolution_config c
  LEFT JOIN public.instance_connection_events e
    ON e.instance_id = c.id
   AND e.occurred_at >= p_start
   AND e.occurred_at < p_end
  WHERE c.organization_id = p_organization_id
  GROUP BY c.id, c.instance_name
  ORDER BY disconnects DESC, reconnects DESC, c.instance_name ASC;
END;
$$;

COMMENT ON FUNCTION public.get_org_instance_disconnection_ranking(uuid, timestamptz, timestamptz) IS
  'Por organizacao: desconexoes e reconexoes por instancia em [p_start, p_end).';

GRANT EXECUTE ON FUNCTION public.get_org_instance_disconnection_ranking(uuid, timestamptz, timestamptz) TO authenticated;

-- ============================================
-- Janela temporal de falhas: prioriza failed_at (edge), retroativo com sent_at/created_at
-- RPC por campanha no período (v1 + v2)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_org_failed_at_failed
  ON public.broadcast_queue (organization_id, failed_at)
  WHERE status = 'failed' AND failed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_2_org_failed_at_failed
  ON public.broadcast_queue_2 (organization_id, failed_at)
  WHERE status = 'failed' AND failed_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_broadcast_dispatch_stats(
  p_organization_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE(sent_total bigint, failed_total bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT 0::bigint, 0::bigint;
    RETURN;
  END IF;

  IF NOT (
    public.user_belongs_to_org(auth.uid(), p_organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  ) THEN
    RETURN QUERY SELECT 0::bigint, 0::bigint;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    (
      (SELECT COUNT(*)::bigint
       FROM public.broadcast_queue q
       WHERE q.organization_id = p_organization_id
         AND q.status = 'sent'
         AND q.sent_at IS NOT NULL
         AND q.sent_at >= p_start
         AND q.sent_at < p_end)
      +
      (SELECT COUNT(*)::bigint
       FROM public.broadcast_queue_2 q
       WHERE q.organization_id = p_organization_id
         AND q.status = 'sent'
         AND q.sent_at IS NOT NULL
         AND q.sent_at >= p_start
         AND q.sent_at < p_end)
    ) AS sent_total,
    (
      (SELECT COUNT(*)::bigint
       FROM public.broadcast_queue q
       WHERE q.organization_id = p_organization_id
         AND q.status = 'failed'
         AND COALESCE(q.failed_at, q.sent_at, q.created_at) >= p_start
         AND COALESCE(q.failed_at, q.sent_at, q.created_at) < p_end)
      +
      (SELECT COUNT(*)::bigint
       FROM public.broadcast_queue_2 q
       WHERE q.organization_id = p_organization_id
         AND q.status = 'failed'
         AND COALESCE(q.failed_at, q.sent_at, q.created_at) >= p_start
         AND COALESCE(q.failed_at, q.sent_at, q.created_at) < p_end)
    ) AS failed_total;
END;
$$;

COMMENT ON FUNCTION public.get_broadcast_dispatch_stats(uuid, timestamptz, timestamptz) IS
  'Totais v1+v2: enviados por sent_at; falhas por COALESCE(failed_at, sent_at, created_at) em [p_start, p_end).';

CREATE OR REPLACE FUNCTION public.get_broadcast_dispatch_extended_stats(
  p_organization_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE(
  sent_total bigint,
  failed_total bigint,
  queued_inserted_total bigint,
  pending_total bigint,
  scheduled_total bigint,
  cancelled_total bigint,
  failed_by_code jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT
      0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, '{}'::jsonb;
    RETURN;
  END IF;

  IF NOT (
    public.user_belongs_to_org(auth.uid(), p_organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  ) THEN
    RETURN QUERY SELECT
      0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, '{}'::jsonb;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    (
      (SELECT COUNT(*)::bigint
       FROM public.broadcast_queue q
       WHERE q.organization_id = p_organization_id
         AND q.status = 'sent'
         AND q.sent_at IS NOT NULL
         AND q.sent_at >= p_start
         AND q.sent_at < p_end)
      +
      (SELECT COUNT(*)::bigint
       FROM public.broadcast_queue_2 q
       WHERE q.organization_id = p_organization_id
         AND q.status = 'sent'
         AND q.sent_at IS NOT NULL
         AND q.sent_at >= p_start
         AND q.sent_at < p_end)
    ) AS sent_total,
    (
      (SELECT COUNT(*)::bigint
       FROM public.broadcast_queue q
       WHERE q.organization_id = p_organization_id
         AND q.status = 'failed'
         AND COALESCE(q.failed_at, q.sent_at, q.created_at) >= p_start
         AND COALESCE(q.failed_at, q.sent_at, q.created_at) < p_end)
      +
      (SELECT COUNT(*)::bigint
       FROM public.broadcast_queue_2 q
       WHERE q.organization_id = p_organization_id
         AND q.status = 'failed'
         AND COALESCE(q.failed_at, q.sent_at, q.created_at) >= p_start
         AND COALESCE(q.failed_at, q.sent_at, q.created_at) < p_end)
    ) AS failed_total,
    (
      (SELECT COUNT(*)::bigint
       FROM public.broadcast_queue q
       WHERE q.organization_id = p_organization_id
         AND q.created_at >= p_start
         AND q.created_at < p_end)
      +
      (SELECT COUNT(*)::bigint
       FROM public.broadcast_queue_2 q
       WHERE q.organization_id = p_organization_id
         AND q.created_at >= p_start
         AND q.created_at < p_end)
    ) AS queued_inserted_total,
    (
      (SELECT COUNT(*)::bigint
       FROM public.broadcast_queue q
       WHERE q.organization_id = p_organization_id
         AND q.status = 'pending'
         AND q.created_at < p_end)
      +
      (SELECT COUNT(*)::bigint
       FROM public.broadcast_queue_2 q
       WHERE q.organization_id = p_organization_id
         AND q.status = 'pending'
         AND q.created_at < p_end)
    ) AS pending_total,
    (
      (SELECT COUNT(*)::bigint
       FROM public.broadcast_queue q
       WHERE q.organization_id = p_organization_id
         AND q.status = 'scheduled'
         AND q.created_at < p_end)
      +
      (SELECT COUNT(*)::bigint
       FROM public.broadcast_queue_2 q
       WHERE q.organization_id = p_organization_id
         AND q.status = 'scheduled'
         AND q.created_at < p_end)
    ) AS scheduled_total,
    (
      (SELECT COUNT(*)::bigint
       FROM public.broadcast_queue q
       WHERE q.organization_id = p_organization_id
         AND q.status = 'cancelled'
         AND q.created_at < p_end)
      +
      (SELECT COUNT(*)::bigint
       FROM public.broadcast_queue_2 q
       WHERE q.organization_id = p_organization_id
         AND q.status = 'cancelled'
         AND q.created_at < p_end)
    ) AS cancelled_total,
    COALESCE(
      (
        SELECT jsonb_object_agg(sub.code, sub.cnt)
        FROM (
          SELECT
            COALESCE(u.failure_code, 'UNSPECIFIED') AS code,
            COUNT(*)::bigint AS cnt
          FROM (
            SELECT q.failure_code
            FROM public.broadcast_queue q
            WHERE q.organization_id = p_organization_id
              AND q.status = 'failed'
              AND COALESCE(q.failed_at, q.sent_at, q.created_at) >= p_start
              AND COALESCE(q.failed_at, q.sent_at, q.created_at) < p_end
            UNION ALL
            SELECT q.failure_code
            FROM public.broadcast_queue_2 q
            WHERE q.organization_id = p_organization_id
              AND q.status = 'failed'
              AND COALESCE(q.failed_at, q.sent_at, q.created_at) >= p_start
              AND COALESCE(q.failed_at, q.sent_at, q.created_at) < p_end
          ) u
          GROUP BY COALESCE(u.failure_code, 'UNSPECIFIED')
        ) sub
      ),
      '{}'::jsonb
    ) AS failed_by_code;
END;
$$;

COMMENT ON FUNCTION public.get_broadcast_dispatch_extended_stats(uuid, timestamptz, timestamptz) IS
  'Métricas v1+v2: falhas no intervalo usam COALESCE(failed_at, sent_at, created_at); demais campos iguais à versão anterior.';

-- Por campanha: atividade no período (enviados / falhas com data no intervalo / linhas criadas no intervalo)
CREATE OR REPLACE FUNCTION public.get_broadcast_dispatch_by_campaign_period(
  p_organization_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE(
  campaign_id uuid,
  source_version text,
  campaign_name text,
  sent_in_period bigint,
  failed_in_period bigint,
  inserted_in_period bigint
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
    s.campaign_id,
    s.source_version,
    COALESCE(c1.name, c2.name, '—') AS campaign_name,
    s.sent_in_period,
    s.failed_in_period,
    s.inserted_in_period
  FROM (
    SELECT
      q.campaign_id,
      'v1'::text AS source_version,
      COUNT(*) FILTER (
        WHERE q.status = 'sent'
          AND q.sent_at IS NOT NULL
          AND q.sent_at >= p_start
          AND q.sent_at < p_end
      )::bigint AS sent_in_period,
      COUNT(*) FILTER (
        WHERE q.status = 'failed'
          AND COALESCE(q.failed_at, q.sent_at, q.created_at) >= p_start
          AND COALESCE(q.failed_at, q.sent_at, q.created_at) < p_end
      )::bigint AS failed_in_period,
      COUNT(*) FILTER (
        WHERE q.created_at >= p_start
          AND q.created_at < p_end
      )::bigint AS inserted_in_period
    FROM public.broadcast_queue q
    WHERE q.organization_id = p_organization_id
    GROUP BY q.campaign_id

    UNION ALL

    SELECT
      q.campaign_id,
      'v2'::text AS source_version,
      COUNT(*) FILTER (
        WHERE q.status = 'sent'
          AND q.sent_at IS NOT NULL
          AND q.sent_at >= p_start
          AND q.sent_at < p_end
      )::bigint AS sent_in_period,
      COUNT(*) FILTER (
        WHERE q.status = 'failed'
          AND COALESCE(q.failed_at, q.sent_at, q.created_at) >= p_start
          AND COALESCE(q.failed_at, q.sent_at, q.created_at) < p_end
      )::bigint AS failed_in_period,
      COUNT(*) FILTER (
        WHERE q.created_at >= p_start
          AND q.created_at < p_end
      )::bigint AS inserted_in_period
    FROM public.broadcast_queue_2 q
    WHERE q.organization_id = p_organization_id
    GROUP BY q.campaign_id
  ) s
  LEFT JOIN public.broadcast_campaigns c1
    ON c1.id = s.campaign_id AND s.source_version = 'v1'
  LEFT JOIN public.broadcast_campaigns_2 c2
    ON c2.id = s.campaign_id AND s.source_version = 'v2'
  WHERE (s.sent_in_period + s.failed_in_period + s.inserted_in_period) > 0
  ORDER BY (s.sent_in_period + s.failed_in_period) DESC, s.campaign_id;
END;
$$;

COMMENT ON FUNCTION public.get_broadcast_dispatch_by_campaign_period(uuid, timestamptz, timestamptz) IS
  'Por campanha (v1 e v2): enviados e falhas com evento no intervalo; inseridos na fila com created_at no intervalo.';

GRANT EXECUTE ON FUNCTION public.get_broadcast_dispatch_by_campaign_period(uuid, timestamptz, timestamptz) TO authenticated;

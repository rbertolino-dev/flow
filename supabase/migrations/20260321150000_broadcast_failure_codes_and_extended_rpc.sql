-- ============================================
-- Falhas tipadas na fila + RPCs estendidas e por campanha
-- ============================================

-- Colunas de classificação (edge functions preenchem no UPDATE de falha)
ALTER TABLE public.broadcast_queue
  ADD COLUMN IF NOT EXISTS failure_code TEXT,
  ADD COLUMN IF NOT EXISTS failure_detail TEXT,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;

ALTER TABLE public.broadcast_queue_2
  ADD COLUMN IF NOT EXISTS failure_code TEXT,
  ADD COLUMN IF NOT EXISTS failure_detail TEXT,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.broadcast_queue.failure_code IS
  'Código estável de falha (ex.: HTTP_429, OTHER) para agregação em dashboards.';
COMMENT ON COLUMN public.broadcast_queue_2.failure_code IS
  'Código estável de falha (ex.: HTTP_429, OTHER) para agregação em dashboards.';

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_org_failure_code_failed
  ON public.broadcast_queue (organization_id, failure_code)
  WHERE status = 'failed';

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_2_org_failure_code_failed
  ON public.broadcast_queue_2 (organization_id, failure_code)
  WHERE status = 'failed';

-- Legado: falhas sem código passam a aparecer como UNSPECIFIED nas agregações SQL;
-- opcional marcar lote antigo (executar uma vez se desejar):
-- UPDATE public.broadcast_queue SET failure_code = 'LEGACY' WHERE status = 'failed' AND failure_code IS NULL;
-- UPDATE public.broadcast_queue_2 SET failure_code = 'LEGACY' WHERE status = 'failed' AND failure_code IS NULL;

-- ============================================
-- Estatísticas estendidas (v1 + v2)
-- sent/failed: mesma janela temporal que get_broadcast_dispatch_stats
-- queued_inserted: linhas criadas na fila no período
-- pending/scheduled/cancelled: snapshot atual (linhas da org ainda nesse status, criadas antes de p_end)
-- failed_by_code: agregação de falhas cuja data de referência cai no período
-- ============================================

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
         AND COALESCE(q.sent_at, q.created_at) >= p_start
         AND COALESCE(q.sent_at, q.created_at) < p_end)
      +
      (SELECT COUNT(*)::bigint
       FROM public.broadcast_queue_2 q
       WHERE q.organization_id = p_organization_id
         AND q.status = 'failed'
         AND COALESCE(q.sent_at, q.created_at) >= p_start
         AND COALESCE(q.sent_at, q.created_at) < p_end)
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
              AND COALESCE(q.sent_at, q.created_at) >= p_start
              AND COALESCE(q.sent_at, q.created_at) < p_end
            UNION ALL
            SELECT q.failure_code
            FROM public.broadcast_queue_2 q
            WHERE q.organization_id = p_organization_id
              AND q.status = 'failed'
              AND COALESCE(q.sent_at, q.created_at) >= p_start
              AND COALESCE(q.sent_at, q.created_at) < p_end
          ) u
          GROUP BY COALESCE(u.failure_code, 'UNSPECIFIED')
        ) sub
      ),
      '{}'::jsonb
    ) AS failed_by_code;
END;
$$;

COMMENT ON FUNCTION public.get_broadcast_dispatch_extended_stats(uuid, timestamptz, timestamptz) IS
  'Métricas v1+v2: enviados/falhas no intervalo, linhas inseridas no intervalo, snapshot pendente/agendado/cancelado (created_at < p_end), falhas por failure_code.';

GRANT EXECUTE ON FUNCTION public.get_broadcast_dispatch_extended_stats(uuid, timestamptz, timestamptz) TO authenticated;

-- ============================================
-- Totais por campanha (detecta v1 ou v2 pelo id)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_broadcast_campaign_queue_totals(p_campaign_id uuid)
RETURNS TABLE(
  source_version text,
  inserted_count bigint,
  sent_count bigint,
  failed_count bigint,
  pending_count bigint,
  scheduled_count bigint,
  cancelled_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_src text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT c.organization_id, 'v1'::text
  INTO v_org, v_src
  FROM public.broadcast_campaigns c
  WHERE c.id = p_campaign_id
  LIMIT 1;

  IF v_org IS NULL THEN
    SELECT c.organization_id, 'v2'::text
    INTO v_org, v_src
    FROM public.broadcast_campaigns_2 c
    WHERE c.id = p_campaign_id
    LIMIT 1;
  END IF;

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

  IF v_src = 'v1' THEN
    RETURN QUERY
    SELECT
      'v1'::text,
      (SELECT COUNT(*)::bigint FROM public.broadcast_queue q WHERE q.campaign_id = p_campaign_id),
      (SELECT COUNT(*)::bigint FROM public.broadcast_queue q WHERE q.campaign_id = p_campaign_id AND q.status = 'sent'),
      (SELECT COUNT(*)::bigint FROM public.broadcast_queue q WHERE q.campaign_id = p_campaign_id AND q.status = 'failed'),
      (SELECT COUNT(*)::bigint FROM public.broadcast_queue q WHERE q.campaign_id = p_campaign_id AND q.status = 'pending'),
      (SELECT COUNT(*)::bigint FROM public.broadcast_queue q WHERE q.campaign_id = p_campaign_id AND q.status = 'scheduled'),
      (SELECT COUNT(*)::bigint FROM public.broadcast_queue q WHERE q.campaign_id = p_campaign_id AND q.status = 'cancelled');
  ELSE
    RETURN QUERY
    SELECT
      'v2'::text,
      (SELECT COUNT(*)::bigint FROM public.broadcast_queue_2 q WHERE q.campaign_id = p_campaign_id),
      (SELECT COUNT(*)::bigint FROM public.broadcast_queue_2 q WHERE q.campaign_id = p_campaign_id AND q.status = 'sent'),
      (SELECT COUNT(*)::bigint FROM public.broadcast_queue_2 q WHERE q.campaign_id = p_campaign_id AND q.status = 'failed'),
      (SELECT COUNT(*)::bigint FROM public.broadcast_queue_2 q WHERE q.campaign_id = p_campaign_id AND q.status = 'pending'),
      (SELECT COUNT(*)::bigint FROM public.broadcast_queue_2 q WHERE q.campaign_id = p_campaign_id AND q.status = 'scheduled'),
      (SELECT COUNT(*)::bigint FROM public.broadcast_queue_2 q WHERE q.campaign_id = p_campaign_id AND q.status = 'cancelled');
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_broadcast_campaign_queue_totals(uuid) IS
  'Contagens por status na fila da campanha (broadcast_queue ou broadcast_queue_2 conforme o id).';

GRANT EXECUTE ON FUNCTION public.get_broadcast_campaign_queue_totals(uuid) TO authenticated;

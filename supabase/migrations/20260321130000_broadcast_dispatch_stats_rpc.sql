-- ============================================
-- RPCs para indicadores de disparo (v1 + v2)
-- ============================================
-- Agregação no banco: sem limite de linhas do PostgREST.
-- SECURITY INVOKER: RLS das tabelas continua aplicável.
-- Enviados: status = sent e sent_at em [p_start, p_end).
-- Falhas: status = failed e COALESCE(sent_at, last_attempt_at, created_at) no intervalo.
-- ============================================

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
         AND COALESCE(q.sent_at, q.last_attempt_at, q.created_at) >= p_start
         AND COALESCE(q.sent_at, q.last_attempt_at, q.created_at) < p_end)
      +
      (SELECT COUNT(*)::bigint
       FROM public.broadcast_queue_2 q
       WHERE q.organization_id = p_organization_id
         AND q.status = 'failed'
         AND COALESCE(q.sent_at, q.last_attempt_at, q.created_at) >= p_start
         AND COALESCE(q.sent_at, q.last_attempt_at, q.created_at) < p_end)
    ) AS failed_total;
END;
$$;

COMMENT ON FUNCTION public.get_broadcast_dispatch_stats(uuid, timestamptz, timestamptz) IS
  'Totais de enviados (sent_at) e falhas (COALESCE sent_at, last_attempt_at, created_at) para broadcast_queue + broadcast_queue_2, sem paginação.';

CREATE OR REPLACE FUNCTION public.get_broadcast_dispatch_sent_by_instance(
  p_organization_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE(instance_id uuid, sent_count bigint)
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
  SELECT t.instance_id, COUNT(*)::bigint AS sent_count
  FROM (
    SELECT q.instance_id
    FROM public.broadcast_queue q
    WHERE q.organization_id = p_organization_id
      AND q.status = 'sent'
      AND q.sent_at IS NOT NULL
      AND q.sent_at >= p_start
      AND q.sent_at < p_end
      AND q.instance_id IS NOT NULL
    UNION ALL
    SELECT q.instance_id
    FROM public.broadcast_queue_2 q
    WHERE q.organization_id = p_organization_id
      AND q.status = 'sent'
      AND q.sent_at IS NOT NULL
      AND q.sent_at >= p_start
      AND q.sent_at < p_end
      AND q.instance_id IS NOT NULL
  ) t
  GROUP BY t.instance_id;
END;
$$;

COMMENT ON FUNCTION public.get_broadcast_dispatch_sent_by_instance(uuid, timestamptz, timestamptz) IS
  'Contagem de enviados por instance_id (v1+v2) no intervalo [p_start, p_end), via sent_at.';

GRANT EXECUTE ON FUNCTION public.get_broadcast_dispatch_stats(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_broadcast_dispatch_sent_by_instance(uuid, timestamptz, timestamptz) TO authenticated;

-- Índices parciais para COUNT por org + sent_at (enviados)
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_org_sent_at_sent
  ON public.broadcast_queue (organization_id, sent_at)
  WHERE status = 'sent' AND sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_2_org_sent_at_sent
  ON public.broadcast_queue_2 (organization_id, sent_at)
  WHERE status = 'sent' AND sent_at IS NOT NULL;

-- Falhas: filtro por COALESCE(sent_at, last_attempt_at, created_at) — last_attempt_at costuma preencher tentativas
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_org_last_attempt_failed
  ON public.broadcast_queue (organization_id, last_attempt_at)
  WHERE status = 'failed';

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_2_org_last_attempt_failed
  ON public.broadcast_queue_2 (organization_id, last_attempt_at)
  WHERE status = 'failed';

-- Realtime UPDATE com payload.old (status anterior) — só infraestrutura de leitura/indicadores
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'broadcast_queue_2'
      AND c.relreplident <> 'f'
  ) THEN
    ALTER TABLE public.broadcast_queue_2 REPLICA IDENTITY FULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'broadcast_queue_2'
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_queue_2;
    END IF;
  END IF;
END $$;

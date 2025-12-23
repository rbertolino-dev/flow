-- Atualizar função get_instance_risk_score para incluir broadcast_queue
CREATE OR REPLACE FUNCTION public.get_instance_risk_score(
  p_instance_id UUID,
  p_hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
  instance_id UUID,
  risk_score INTEGER,
  error_rate NUMERIC,
  messages_sent_total INTEGER,
  messages_failed_total INTEGER,
  consecutive_failures_max INTEGER,
  rate_limits_detected INTEGER,
  connection_state_changes_total INTEGER,
  last_connection_state TEXT,
  last_error_message TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_messages_sent INT := 0;
  v_messages_failed INT := 0;
  v_error_rate NUMERIC := 0;
  v_consecutive_failures INT := 0;
  v_rate_limits INT := 0;
  v_connection_changes INT := 0;
  v_last_state TEXT;
  v_last_error TEXT;
  v_risk_score INT := 0;
  v_scheduled_sent INT := 0;
  v_scheduled_failed INT := 0;
  v_broadcast_sent INT := 0;
  v_broadcast_failed INT := 0;
BEGIN
  v_period_end := NOW();
  v_period_start := v_period_end - (p_hours_back || ' hours')::INTERVAL;

  -- Contar mensagens de scheduled_messages
  SELECT 
    COALESCE(SUM(CASE WHEN sm.status = 'sent' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN sm.status = 'failed' THEN 1 ELSE 0 END), 0)
  INTO v_scheduled_sent, v_scheduled_failed
  FROM public.scheduled_messages sm
  WHERE sm.instance_id = p_instance_id
    AND sm.sent_at >= v_period_start
    AND sm.sent_at <= v_period_end
    AND sm.status IN ('sent', 'failed');

  -- Contar mensagens de broadcast_queue
  SELECT 
    COALESCE(SUM(CASE WHEN bq.status = 'sent' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN bq.status = 'failed' THEN 1 ELSE 0 END), 0)
  INTO v_broadcast_sent, v_broadcast_failed
  FROM public.broadcast_queue bq
  WHERE bq.instance_id = p_instance_id
    AND bq.sent_at >= v_period_start
    AND bq.sent_at <= v_period_end
    AND bq.status IN ('sent', 'failed');

  -- Somar totais
  v_messages_sent := v_scheduled_sent + v_broadcast_sent;
  v_messages_failed := v_scheduled_failed + v_broadcast_failed;

  -- Calcular taxa de erro
  IF (v_messages_sent + v_messages_failed) > 0 THEN
    v_error_rate := (v_messages_failed::NUMERIC / (v_messages_sent + v_messages_failed)) * 100;
  END IF;

  -- Detectar rate limits nos logs
  SELECT COUNT(*)
  INTO v_rate_limits
  FROM public.evolution_logs el
  WHERE el.instance = p_instance_id::TEXT
    AND el.created_at >= v_period_start
    AND el.created_at <= v_period_end
    AND (
      el.message ILIKE '%rate limit%'
      OR el.message ILIKE '%too many requests%'
      OR el.message ILIKE '%429%'
    );

  -- Contar mudanças de estado de conexão
  SELECT COUNT(*)
  INTO v_connection_changes
  FROM public.evolution_logs el
  WHERE el.instance = p_instance_id::TEXT
    AND el.created_at >= v_period_start
    AND el.created_at <= v_period_end
    AND el.event IN ('connection.update', 'status.instance', 'qrcode.updated');

  -- Obter último estado e erro
  SELECT 
    COALESCE(el.payload->>'state', el.payload->>'status')::TEXT,
    el.message
  INTO v_last_state, v_last_error
  FROM public.evolution_logs el
  WHERE el.instance = p_instance_id::TEXT
    AND el.created_at >= v_period_start
    AND el.created_at <= v_period_end
    AND el.level = 'error'
  ORDER BY el.created_at DESC
  LIMIT 1;

  -- Calcular consecutive failures (usando ambas as tabelas)
  WITH recent_failures AS (
    -- Scheduled messages
    SELECT sm.status, sm.sent_at as timestamp
    FROM public.scheduled_messages sm
    WHERE sm.instance_id = p_instance_id
      AND sm.sent_at >= v_period_start
      AND sm.sent_at <= v_period_end
      AND sm.status IN ('sent', 'failed')
    UNION ALL
    -- Broadcast messages
    SELECT bq.status, bq.sent_at as timestamp
    FROM public.broadcast_queue bq
    WHERE bq.instance_id = p_instance_id
      AND bq.sent_at >= v_period_start
      AND bq.sent_at <= v_period_end
      AND bq.status IN ('sent', 'failed')
    ORDER BY timestamp DESC
    LIMIT 100
  )
  SELECT COALESCE(MAX(consecutive_count), 0)
  INTO v_consecutive_failures
  FROM (
    SELECT COUNT(*) as consecutive_count
    FROM (
      SELECT 
        rf.status,
        SUM(CASE WHEN rf.status = 'sent' THEN 1 ELSE 0 END) 
          OVER (ORDER BY rf.timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as grp
      FROM recent_failures rf
      WHERE rf.status = 'failed'
    ) grouped
    GROUP BY grp
  ) counts;

  -- Calcular score de risco (0-100)
  v_risk_score := LEAST(100, 
    (LEAST(v_error_rate, 100) * 0.4)::INT +
    (LEAST(v_rate_limits * 10, 100) * 0.3)::INT +
    (LEAST(v_consecutive_failures * 5, 100) * 0.2)::INT +
    (LEAST(v_connection_changes * 2, 100) * 0.1)::INT
  );

  RETURN QUERY SELECT
    p_instance_id,
    v_risk_score,
    ROUND(v_error_rate, 2),
    v_messages_sent,
    v_messages_failed,
    v_consecutive_failures,
    v_rate_limits,
    v_connection_changes,
    v_last_state,
    v_last_error,
    v_period_start,
    v_period_end;
END;
$$;
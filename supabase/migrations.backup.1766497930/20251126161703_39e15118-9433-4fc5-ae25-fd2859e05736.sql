-- Corrigir função para usar UUID ao invés de TEXT
DROP FUNCTION IF EXISTS public.get_instance_risk_score(TEXT, INT);

CREATE OR REPLACE FUNCTION public.get_instance_risk_score(
  p_instance_id UUID,
  p_hours_back INT DEFAULT 24
)
RETURNS TABLE (
  instance_id UUID,
  risk_score INT,
  error_rate NUMERIC,
  messages_sent_total INT,
  messages_failed_total INT,
  consecutive_failures_max INT,
  rate_limits_detected INT,
  connection_state_changes_total INT,
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
BEGIN
  -- Definir período de análise
  v_period_end := NOW();
  v_period_start := v_period_end - (p_hours_back || ' hours')::INTERVAL;

  -- Contar mensagens enviadas via scheduled_messages
  SELECT COUNT(*)
  INTO v_messages_sent
  FROM public.scheduled_messages sm
  WHERE sm.instance_id = p_instance_id
    AND sm.sent_at >= v_period_start
    AND sm.sent_at <= v_period_end
    AND sm.status = 'sent';

  -- Contar mensagens falhadas
  SELECT COUNT(*)
  INTO v_messages_failed
  FROM public.scheduled_messages sm
  WHERE sm.instance_id = p_instance_id
    AND sm.sent_at >= v_period_start
    AND sm.sent_at <= v_period_end
    AND sm.status = 'failed';

  -- Calcular taxa de erro
  IF (v_messages_sent + v_messages_failed) > 0 THEN
    v_error_rate := (v_messages_failed::NUMERIC / (v_messages_sent + v_messages_failed)) * 100;
  END IF;

  -- Detectar rate limits nos logs (buscar por padrões de erro conhecidos)
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

  -- Calcular consecutive failures (máximo de falhas consecutivas)
  WITH recent_failures AS (
    SELECT 
      sm.status,
      sm.sent_at,
      LAG(sm.status) OVER (ORDER BY sm.sent_at) as prev_status
    FROM public.scheduled_messages sm
    WHERE sm.instance_id = p_instance_id
      AND sm.sent_at >= v_period_start
      AND sm.sent_at <= v_period_end
      AND sm.status IN ('sent', 'failed')
    ORDER BY sm.sent_at DESC
    LIMIT 100
  )
  SELECT COALESCE(MAX(consecutive_count), 0)
  INTO v_consecutive_failures
  FROM (
    SELECT 
      COUNT(*) as consecutive_count
    FROM (
      SELECT 
        rf.status,
        SUM(CASE WHEN rf.status = 'sent' THEN 1 ELSE 0 END) 
          OVER (ORDER BY rf.sent_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as grp
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

  -- Retornar resultado
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
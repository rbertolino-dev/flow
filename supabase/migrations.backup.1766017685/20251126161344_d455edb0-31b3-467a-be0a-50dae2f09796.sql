-- Função para calcular métricas de saúde e score de risco de instâncias Evolution API
CREATE OR REPLACE FUNCTION public.get_instance_risk_score(
  p_instance_id TEXT,
  p_hours_back INT DEFAULT 24
)
RETURNS TABLE (
  instance_id TEXT,
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
  FROM public.scheduled_messages
  WHERE instance_id = p_instance_id
    AND sent_at >= v_period_start
    AND sent_at <= v_period_end
    AND status = 'sent';

  -- Contar mensagens falhadas
  SELECT COUNT(*)
  INTO v_messages_failed
  FROM public.scheduled_messages
  WHERE instance_id = p_instance_id
    AND sent_at >= v_period_start
    AND sent_at <= v_period_end
    AND status = 'failed';

  -- Calcular taxa de erro
  IF (v_messages_sent + v_messages_failed) > 0 THEN
    v_error_rate := (v_messages_failed::NUMERIC / (v_messages_sent + v_messages_failed)) * 100;
  END IF;

  -- Detectar rate limits nos logs (buscar por padrões de erro conhecidos)
  SELECT COUNT(*)
  INTO v_rate_limits
  FROM public.evolution_logs
  WHERE instance = p_instance_id
    AND created_at >= v_period_start
    AND created_at <= v_period_end
    AND (
      message ILIKE '%rate limit%'
      OR message ILIKE '%too many requests%'
      OR message ILIKE '%429%'
    );

  -- Contar mudanças de estado de conexão
  SELECT COUNT(*)
  INTO v_connection_changes
  FROM public.evolution_logs
  WHERE instance = p_instance_id
    AND created_at >= v_period_start
    AND created_at <= v_period_end
    AND event IN ('connection.update', 'status.instance', 'qrcode.updated');

  -- Obter último estado e erro
  SELECT 
    COALESCE(payload->>'state', payload->>'status')::TEXT,
    message
  INTO v_last_state, v_last_error
  FROM public.evolution_logs
  WHERE instance = p_instance_id
    AND created_at >= v_period_start
    AND created_at <= v_period_end
    AND level = 'error'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Calcular consecutive failures (máximo de falhas consecutivas)
  -- Isso é uma aproximação baseada em mensagens falhadas recentes
  WITH recent_failures AS (
    SELECT 
      status,
      sent_at,
      LAG(status) OVER (ORDER BY sent_at) as prev_status
    FROM public.scheduled_messages
    WHERE instance_id = p_instance_id
      AND sent_at >= v_period_start
      AND sent_at <= v_period_end
      AND status IN ('sent', 'failed')
    ORDER BY sent_at DESC
    LIMIT 100
  )
  SELECT COALESCE(MAX(consecutive_count), 0)
  INTO v_consecutive_failures
  FROM (
    SELECT 
      COUNT(*) as consecutive_count
    FROM (
      SELECT 
        status,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) 
          OVER (ORDER BY sent_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as grp
      FROM recent_failures
      WHERE status = 'failed'
    ) grouped
    GROUP BY grp
  ) counts;

  -- Calcular score de risco (0-100)
  -- Pesos: error_rate (40%), rate_limits (30%), consecutive_failures (20%), connection_changes (10%)
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
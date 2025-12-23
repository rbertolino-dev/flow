-- ============================================================================
-- OTIMIZAÇÕES DE PERFORMANCE - FUNÇÕES SQL
-- ============================================================================

-- FUNÇÃO 1: get_daily_metrics
-- Reduz de 120 queries (30 dias × 4 queries) para 1 query apenas
CREATE OR REPLACE FUNCTION get_daily_metrics(
  start_date timestamp with time zone,
  end_date timestamp with time zone
)
RETURNS TABLE (
  date date,
  incoming_count bigint,
  broadcast_count bigint,
  scheduled_count bigint,
  leads_count bigint
) 
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  day_date date;
BEGIN
  IF start_date IS NULL OR end_date IS NULL THEN
    RAISE EXCEPTION 'start_date e end_date são obrigatórios';
  END IF;
  
  day_date := DATE(start_date);
  
  WHILE day_date <= DATE(end_date) LOOP
    RETURN QUERY
    SELECT 
      day_date as date,
      COALESCE((
        SELECT COUNT(*)::bigint 
        FROM whatsapp_messages
        WHERE DATE(timestamp) = day_date
        AND direction = 'incoming'
      ), 0)::bigint as incoming_count,
      COALESCE((
        SELECT COUNT(*)::bigint 
        FROM broadcast_queue
        WHERE DATE(sent_at) = day_date
        AND status = 'sent'
      ), 0)::bigint as broadcast_count,
      COALESCE((
        SELECT COUNT(*)::bigint 
        FROM scheduled_messages
        WHERE DATE(sent_at) = day_date
        AND status = 'sent'
      ), 0)::bigint as scheduled_count,
      COALESCE((
        SELECT COUNT(*)::bigint 
        FROM leads
        WHERE DATE(created_at) <= day_date
        AND deleted_at IS NULL
      ), 0)::bigint as leads_count;
    
    day_date := day_date + INTERVAL '1 day';
  END LOOP;
END;
$$;

COMMENT ON FUNCTION get_daily_metrics(timestamp with time zone, timestamp with time zone) IS 
  'Retorna métricas diárias agregadas para reduzir queries. Retorna todos os dias do intervalo, mesmo sem dados.';

-- FUNÇÃO 2: get_organization_metrics
-- Reduz de 80 queries (10 orgs × 8 queries) para 1 query apenas
CREATE OR REPLACE FUNCTION get_organization_metrics(
  current_month_start timestamp with time zone,
  current_month_end timestamp with time zone,
  previous_month_start timestamp with time zone,
  previous_month_end timestamp with time zone
)
RETURNS TABLE (
  org_id uuid,
  org_name text,
  current_incoming bigint,
  current_broadcast bigint,
  current_scheduled bigint,
  current_leads bigint,
  prev_incoming bigint,
  prev_broadcast bigint,
  prev_scheduled bigint,
  prev_leads bigint
) 
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF current_month_start IS NULL OR current_month_end IS NULL OR
     previous_month_start IS NULL OR previous_month_end IS NULL THEN
    RAISE EXCEPTION 'Todos os parâmetros de data são obrigatórios';
  END IF;

  RETURN QUERY
  SELECT 
    o.id as org_id,
    o.name as org_name,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM whatsapp_messages
      WHERE organization_id = o.id
      AND direction = 'incoming'
      AND timestamp BETWEEN current_month_start AND current_month_end
    ), 0)::bigint as current_incoming,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM broadcast_queue
      WHERE organization_id = o.id
      AND status = 'sent'
      AND sent_at BETWEEN current_month_start AND current_month_end
    ), 0)::bigint as current_broadcast,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM scheduled_messages
      WHERE organization_id = o.id
      AND status = 'sent'
      AND sent_at BETWEEN current_month_start AND current_month_end
    ), 0)::bigint as current_scheduled,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM leads
      WHERE organization_id = o.id
      AND deleted_at IS NULL
    ), 0)::bigint as current_leads,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM whatsapp_messages
      WHERE organization_id = o.id
      AND direction = 'incoming'
      AND timestamp BETWEEN previous_month_start AND previous_month_end
    ), 0)::bigint as prev_incoming,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM broadcast_queue
      WHERE organization_id = o.id
      AND status = 'sent'
      AND sent_at BETWEEN previous_month_start AND previous_month_end
    ), 0)::bigint as prev_broadcast,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM scheduled_messages
      WHERE organization_id = o.id
      AND status = 'sent'
      AND sent_at BETWEEN previous_month_start AND previous_month_end
    ), 0)::bigint as prev_scheduled,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM leads
      WHERE organization_id = o.id
      AND deleted_at IS NULL
      AND created_at <= previous_month_end
    ), 0)::bigint as prev_leads
  FROM organizations o
  ORDER BY o.name;
END;
$$;

COMMENT ON FUNCTION get_organization_metrics(
  timestamp with time zone, 
  timestamp with time zone, 
  timestamp with time zone, 
  timestamp with time zone
) IS 
  'Retorna métricas de todas as organizações para mês atual e anterior de forma otimizada. Reduz de 80 queries para 1 query.';
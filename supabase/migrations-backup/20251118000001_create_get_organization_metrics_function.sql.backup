-- Função SQL para buscar métricas de organizações de forma otimizada
-- Reduz de 80 queries (10 orgs × 8 queries) para 1 query apenas
-- Retorna métricas do mês atual e anterior para todas as organizações

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
  -- Validar parâmetros
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

-- Comentário explicativo
COMMENT ON FUNCTION get_organization_metrics(
  timestamp with time zone, 
  timestamp with time zone, 
  timestamp with time zone, 
  timestamp with time zone
) IS 
  'Retorna métricas de todas as organizações para mês atual e anterior de forma otimizada. Reduz de 80 queries para 1 query.';


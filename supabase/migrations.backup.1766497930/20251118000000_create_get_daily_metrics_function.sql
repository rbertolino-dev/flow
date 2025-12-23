-- Função SQL para buscar métricas diárias de forma otimizada
-- Reduz de 120 queries (30 dias × 4 queries) para 1 query apenas
-- Garante que retorna todos os dias do intervalo, mesmo sem dados

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
  -- Garantir que start_date e end_date são válidos
  IF start_date IS NULL OR end_date IS NULL THEN
    RAISE EXCEPTION 'start_date e end_date são obrigatórios';
  END IF;
  
  -- Normalizar para início do dia
  day_date := DATE(start_date);
  
  -- Gerar todos os dias do intervalo (garante que retorna todos os dias, mesmo sem dados)
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

-- Comentário explicativo
COMMENT ON FUNCTION get_daily_metrics(timestamp with time zone, timestamp with time zone) IS 
  'Retorna métricas diárias agregadas para reduzir queries. Retorna todos os dias do intervalo, mesmo sem dados.';


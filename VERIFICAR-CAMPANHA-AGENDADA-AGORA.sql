-- Verificar campanha criada recentemente e agendada
SELECT 
  id,
  name,
  status,
  scheduled_start_at,
  started_at,
  created_at,
  -- Converter para timezone do Brasil
  scheduled_start_at AT TIME ZONE 'America/Sao_Paulo' as scheduled_start_at_brt,
  -- Horário atual
  NOW() as agora_utc,
  NOW() AT TIME ZONE 'America/Sao_Paulo' as agora_brt,
  -- Verificar se já passou o horário agendado
  CASE 
    WHEN scheduled_start_at IS NULL THEN 'Sem agendamento'
    WHEN scheduled_start_at <= NOW() THEN '✅ JÁ DEVERIA TER SIDO PROCESSADA'
    ELSE '⏳ AINDA NÃO CHEGOU O HORÁRIO'
  END as status_agendamento,
  -- Diferença em minutos
  EXTRACT(EPOCH FROM (NOW() - scheduled_start_at)) / 60 as minutos_diferenca
FROM broadcast_campaigns
WHERE status = 'draft'
  AND scheduled_start_at IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

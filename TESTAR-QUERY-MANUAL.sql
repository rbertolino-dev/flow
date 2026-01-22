-- Testar a query exata que a edge function usa
-- Simular o que a função faz

-- 1. Horário atual em ISO (como a função faz)
SELECT 
  NOW() as agora_utc,
  NOW()::text as agora_texto,
  (NOW()::timestamptz)::text as agora_timestamptz,
  to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as agora_iso_format;

-- 2. Campanhas que a query deveria encontrar
SELECT 
  id,
  name,
  status,
  scheduled_start_at,
  scheduled_start_at AT TIME ZONE 'America/Sao_Paulo' as scheduled_start_at_brt,
  NOW() as agora_utc,
  NOW() AT TIME ZONE 'America/Sao_Paulo' as agora_brt,
  -- Verificar condições da query
  CASE WHEN status = 'draft' THEN '✅ Status OK' ELSE '❌ Status diferente' END as check_status,
  CASE WHEN scheduled_start_at IS NOT NULL THEN '✅ Tem agendamento' ELSE '❌ Sem agendamento' END as check_agendamento,
  CASE WHEN scheduled_start_at <= NOW() THEN '✅ Horário passou' ELSE '❌ Horário ainda não chegou' END as check_horario,
  -- Diferença em segundos
  EXTRACT(EPOCH FROM (NOW() - scheduled_start_at)) as segundos_diferenca
FROM broadcast_campaigns
WHERE status = 'draft'
  AND scheduled_start_at IS NOT NULL
  AND scheduled_start_at <= NOW()
ORDER BY created_at DESC
LIMIT 10;

-- 3. Todas campanhas agendadas (sem filtro de horário)
SELECT 
  id,
  name,
  status,
  scheduled_start_at,
  scheduled_start_at AT TIME ZONE 'America/Sao_Paulo' as scheduled_start_at_brt,
  CASE WHEN scheduled_start_at <= NOW() THEN '✅ DEVERIA SER PROCESSADA' ELSE '⏳ AINDA NÃO' END as status_processamento
FROM broadcast_campaigns
WHERE status = 'draft'
  AND scheduled_start_at IS NOT NULL
ORDER BY scheduled_start_at ASC;

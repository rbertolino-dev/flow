-- ============================================
-- Verificar Timezone do Banco de Dados
-- ============================================
-- Execute este script para verificar timezone e como datas estão armazenadas
-- ============================================

-- 1. Verificar timezone do banco
SELECT 
  'Timezone do Banco' as tipo,
  current_setting('timezone') as timezone_atual,
  now() as agora_utc,
  now() AT TIME ZONE 'America/Sao_Paulo' as agora_brt;

-- 2. Verificar campanhas agendadas com conversão de timezone
SELECT 
  'Campanhas Agendadas' as tipo,
  id,
  name,
  status,
  scheduled_start_at,
  scheduled_start_at AT TIME ZONE 'UTC' as utc,
  scheduled_start_at AT TIME ZONE 'America/Sao_Paulo' as brt,
  NOW() as agora_utc,
  NOW() AT TIME ZONE 'America/Sao_Paulo' as agora_brt,
  CASE 
    WHEN scheduled_start_at <= NOW() AND status = 'draft' THEN '⚠️ DEVERIA TER INICIADO'
    WHEN scheduled_start_at > NOW() THEN '✅ Agendada para futuro'
    WHEN status = 'running' THEN '✅ Já iniciou'
    ELSE '❓ Status: ' || status
  END as diagnostico
FROM broadcast_campaigns
WHERE scheduled_start_at IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 3. Verificar diferença de timezone
SELECT 
  'Diferença de Timezone' as tipo,
  EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'America/Sao_Paulo') - (NOW() AT TIME ZONE 'UTC'))) / 3600 as diferenca_horas,
  (NOW() AT TIME ZONE 'America/Sao_Paulo') as agora_brt,
  (NOW() AT TIME ZONE 'UTC') as agora_utc,
  CASE 
    WHEN EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'America/Sao_Paulo') - (NOW() AT TIME ZONE 'UTC'))) / 3600 = -3 
    THEN '✅ Diferença correta: Brasil está 3 horas atrás de UTC'
    ELSE '⚠️ Diferença diferente do esperado'
  END as diagnostico;

-- 4. Teste: Criar data como se fosse do Brasil e ver como fica em UTC
SELECT 
  'Teste Conversão' as tipo,
  '2026-01-22 19:40:00'::timestamp as horario_brt_visual,
  '2026-01-22 19:40:00'::timestamp AT TIME ZONE 'America/Sao_Paulo' AT TIME ZONE 'UTC' as convertido_utc,
  '2026-01-22 19:40:00+00'::timestamptz as utc_direto;

-- ============================================
-- INTERPRETAÇÃO:
-- ============================================
-- Se "agora_brt" mostrar horário diferente de "agora_utc":
--   → Há diferença de timezone (3 horas no Brasil)
--
-- Se "brt" da campanha mostrar horário diferente do que usuário agendou:
--   → Problema na conversão de timezone
--
-- Se "convertido_utc" mostrar 22:40 quando agendou 19:40:
--   → Confirma que há conversão de timezone (BRT para UTC)
-- ============================================

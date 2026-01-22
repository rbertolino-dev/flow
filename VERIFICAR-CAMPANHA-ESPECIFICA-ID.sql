-- ============================================
-- Verificar Campanha Específica que Não Disparou
-- ============================================
-- ID da campanha: de3e4282-d7ff-48ed-ab9c-5f9210f5be80
-- ============================================

-- 1. Verificar detalhes da campanha
SELECT 
  'Detalhes da Campanha' as tipo,
  id,
  name,
  status,
  scheduled_start_at,
  started_at,
  created_at,
  NOW() as agora,
  EXTRACT(EPOCH FROM (NOW() - scheduled_start_at)) / 60 as minutos_atrasados,
  CASE 
    WHEN scheduled_start_at <= NOW() AND status = 'draft' THEN '⚠️ DEVERIA TER INICIADO!'
    WHEN status = 'running' THEN '✅ Já iniciou'
    ELSE '❓ Status desconhecido'
  END as diagnostico
FROM broadcast_campaigns
WHERE id = 'de3e4282-d7ff-48ed-ab9c-5f9210f5be80';

-- 2. Verificar se campanha tem itens na fila (CRÍTICO!)
SELECT 
  'Itens na Fila' as tipo,
  COUNT(*) as total_itens,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendentes,
  COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as agendados,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as enviados,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as falhados,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ PROBLEMA CRÍTICO: Campanha NÃO tem itens na fila!'
    WHEN COUNT(CASE WHEN status = 'pending' THEN 1 END) = 0 THEN '⚠️ Nenhum item pendente'
    ELSE '✅ Tem itens na fila'
  END as diagnostico
FROM broadcast_queue
WHERE campaign_id = 'de3e4282-d7ff-48ed-ab9c-5f9210f5be80';

-- 3. Verificar detalhes dos itens na fila
SELECT 
  'Detalhes dos Itens' as tipo,
  id,
  campaign_id,
  contact_phone,
  status,
  scheduled_for,
  created_at
FROM broadcast_queue
WHERE campaign_id = 'de3e4282-d7ff-48ed-ab9c-5f9210f5be80'
ORDER BY created_at DESC
LIMIT 10;

-- 4. Verificar últimas execuções do cron job (jobid 18)
SELECT 
  'Execuções do Cron' as tipo,
  start_time,
  end_time,
  status,
  CASE 
    WHEN status = 'succeeded' THEN '✅ Sucesso'
    WHEN status = 'failed' THEN '❌ Falhou'
    ELSE '⚠️ ' || status
  END as resultado,
  LEFT(return_message, 200) as mensagem
FROM cron.job_run_details 
WHERE jobid = 18
  AND start_time > '2026-01-22 19:40:00'  -- Depois do horário agendado
ORDER BY start_time DESC 
LIMIT 10;

-- 5. Verificar se função processou esta campanha (verificar logs)
-- Nota: Isso precisa ser verificado nos logs da edge function no Dashboard

-- ============================================
-- INTERPRETAÇÃO:
-- ============================================
-- Se verificação 2 mostrar "NÃO tem itens na fila":
--   → PROBLEMA: Campanha foi criada sem contatos na fila
--   → A função process-scheduled-campaigns não vai processar campanhas sem itens
--   → SOLUÇÃO: Verificar se ao criar campanha, contatos foram adicionados à fila
--
-- Se verificação 4 não mostrar execuções recentes:
--   → Cron job não está executando
--   → Verificar se está ativo
--
-- Se verificação 4 mostrar execuções mas status 'failed':
--   → Função tem erro
--   → Verificar logs da edge function
-- ============================================

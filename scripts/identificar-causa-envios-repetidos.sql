-- ============================================
-- Identificar Causa: Envios Repetidos
-- ============================================
-- Identificar se foram duplicatas reais ou modo separate
-- ============================================

-- 1. ANÁLISE PRINCIPAL: Verificar se foram DUPLICATAS REAIS (mesmo phone+campaign+instance)
-- Se houver múltiplas mensagens com mesmo phone+campaign+instance = PROBLEMA NA CRIAÇÃO
SELECT
  'DUPLICATAS REAIS (mesmo phone+campaign+instance)' as tipo_problema,
  phone,
  campaign_id,
  instance_id,
  COUNT(*) as total_mensagens,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as total_enviadas,
  array_agg(id ORDER BY created_at) as ids,
  array_agg(status ORDER BY created_at) as status_list,
  array_agg(created_at ORDER BY created_at) as created_at_list,
  array_agg(sent_at ORDER BY created_at) as sent_at_list,
  MIN(created_at) as primeira_criacao,
  MAX(created_at) as ultima_criacao,
  EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 60 as minutos_entre_criacoes,
  MIN(sent_at) as primeira_envio,
  MAX(sent_at) as ultima_envio,
  EXTRACT(EPOCH FROM (MAX(sent_at) - MIN(sent_at))) / 60 as minutos_entre_envios
FROM broadcast_queue
WHERE phone = '5521966224051'
GROUP BY phone, campaign_id, instance_id
HAVING COUNT(*) > 1  -- Múltiplas mensagens para mesma combinação = DUPLICATA REAL
ORDER BY COUNT(*) DESC;

-- 2. ANÁLISE: Verificar se foi MODO SEPARATE (múltiplas instâncias para mesma campanha)
-- Se houver múltiplas instâncias para mesma campanha = COMPORTAMENTO ESPERADO
SELECT
  'MODO SEPARATE (múltiplas instâncias)' as tipo_comportamento,
  phone,
  campaign_id,
  COUNT(DISTINCT instance_id) as total_instancias,
  COUNT(*) as total_mensagens,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as total_enviadas,
  array_agg(DISTINCT instance_id) as instance_ids,
  MIN(created_at) as primeira_criacao,
  MAX(created_at) as ultima_criacao,
  MIN(sent_at) as primeira_envio,
  MAX(sent_at) as ultima_envio,
  EXTRACT(EPOCH FROM (MAX(sent_at) - MIN(sent_at))) / 60 as minutos_entre_envios
FROM broadcast_queue
WHERE phone = '5521966224051'
  AND status = 'sent'
GROUP BY phone, campaign_id
HAVING COUNT(DISTINCT instance_id) > 1  -- Múltiplas instâncias = MODO SEPARATE
ORDER BY COUNT(DISTINCT instance_id) DESC;

-- 3. RESUMO POR CAMPANHA: Quantas vezes cada campanha enviou para esse número
SELECT
  campaign_id,
  COUNT(DISTINCT instance_id) as total_instancias,
  COUNT(*) as total_mensagens_criadas,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as total_enviadas,
  MIN(created_at) as primeira_criacao,
  MAX(created_at) as ultima_criacao,
  MIN(sent_at) as primeira_envio,
  MAX(sent_at) as ultima_envio,
  EXTRACT(EPOCH FROM (MAX(sent_at) - MIN(sent_at))) / 60 as minutos_entre_primeiro_ultimo_envio
FROM broadcast_queue
WHERE phone = '5521966224051'
  AND status = 'sent'
GROUP BY campaign_id
ORDER BY total_enviadas DESC;

-- 4. DETALHAMENTO: Ver TODAS as mensagens enviadas para esse número
SELECT
  id,
  phone,
  campaign_id,
  instance_id,
  status,
  created_at,
  scheduled_for,
  sent_at,
  EXTRACT(EPOCH FROM (sent_at - created_at)) / 60 as minutos_ate_envio,
  EXTRACT(EPOCH FROM (sent_at - scheduled_for)) / 60 as minutos_apos_agendamento
FROM broadcast_queue
WHERE phone = '5521966224051'
  AND status = 'sent'
ORDER BY sent_at DESC
LIMIT 100;

-- 5. VERIFICAR: Se há mensagens sendo criadas AGORA (últimos 10 minutos)
SELECT
  id,
  phone,
  campaign_id,
  instance_id,
  status,
  created_at,
  scheduled_for,
  sent_at,
  error_message
FROM broadcast_queue
WHERE phone = '5521966224051'
  AND created_at >= NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;

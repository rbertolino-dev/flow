-- ============================================
-- Análise do Histórico: Envios Duplicados
-- ============================================
-- Identificar por que a mesma mensagem foi enviada repetidamente
-- ============================================

-- 1. Ver TODAS as mensagens SENT para esse número (histórico completo)
SELECT
  id,
  phone,
  campaign_id,
  instance_id,
  status,
  created_at,
  scheduled_for,
  sent_at,
  error_message,
  EXTRACT(EPOCH FROM (sent_at - created_at)) / 60 as minutos_ate_envio,
  EXTRACT(EPOCH FROM (sent_at - scheduled_for)) / 60 as minutos_apos_agendamento
FROM broadcast_queue
WHERE phone = '5521966224051'
  AND status = 'sent'
ORDER BY sent_at DESC
LIMIT 100;

-- 2. Verificar se foram MÚLTIPLAS mensagens criadas (duplicatas na criação)
SELECT
  phone,
  campaign_id,
  instance_id,
  COUNT(*) as total_mensagens_criadas,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as total_enviadas,
  array_agg(id ORDER BY created_at) as ids_criadas,
  array_agg(status ORDER BY created_at) as status_list,
  array_agg(created_at ORDER BY created_at) as created_at_list,
  array_agg(sent_at ORDER BY created_at) as sent_at_list,
  MIN(created_at) as primeira_criacao,
  MAX(created_at) as ultima_criacao,
  MIN(sent_at) as primeira_envio,
  MAX(sent_at) as ultima_envio,
  EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 60 as minutos_entre_criacoes,
  EXTRACT(EPOCH FROM (MAX(sent_at) - MIN(sent_at))) / 60 as minutos_entre_envios
FROM broadcast_queue
WHERE phone = '5521966224051'
GROUP BY phone, campaign_id, instance_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 3. Verificar se a MESMA mensagem foi processada múltiplas vezes
-- (mesma mensagem com múltiplos sent_at - isso não deveria acontecer)
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
  AND id IN (
    -- IDs que aparecem múltiplas vezes com status sent
    SELECT id
    FROM broadcast_queue
    WHERE phone = '5521966224051'
      AND status = 'sent'
    GROUP BY id
    HAVING COUNT(*) > 1
  )
ORDER BY sent_at DESC;

-- 4. Verificar padrão de criação: mensagens criadas muito próximas no tempo
SELECT
  phone,
  campaign_id,
  instance_id,
  created_at,
  scheduled_for,
  sent_at,
  status,
  EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY phone, campaign_id, instance_id ORDER BY created_at))) / 60 as minutos_da_anterior
FROM broadcast_queue
WHERE phone = '5521966224051'
ORDER BY created_at DESC
LIMIT 50;

-- 5. Verificar se há mensagens com mesmo scheduled_for (criadas ao mesmo tempo)
SELECT
  scheduled_for,
  phone,
  campaign_id,
  instance_id,
  COUNT(*) as total_mensagens,
  array_agg(id ORDER BY created_at) as ids,
  array_agg(status ORDER BY created_at) as status_list,
  array_agg(created_at ORDER BY created_at) as created_at_list
FROM broadcast_queue
WHERE phone = '5521966224051'
GROUP BY scheduled_for, phone, campaign_id, instance_id
HAVING COUNT(*) > 1
ORDER BY scheduled_for DESC;

-- 6. Resumo: Quantas vezes cada combinação phone+campaign+instance foi enviada
SELECT
  phone,
  campaign_id,
  instance_id,
  COUNT(*) as total_mensagens_criadas,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as total_enviadas,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as total_canceladas,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as total_falhas,
  MIN(created_at) as primeira_criacao,
  MAX(created_at) as ultima_criacao,
  MIN(sent_at) as primeira_envio,
  MAX(sent_at) as ultima_envio
FROM broadcast_queue
WHERE phone = '5521966224051'
GROUP BY phone, campaign_id, instance_id
ORDER BY total_enviadas DESC, total_mensagens_criadas DESC;

-- ============================================
-- Testar se o Índice Único Está Funcionando
-- ============================================
-- Este SQL tenta criar uma duplicata para testar se o índice bloqueia
-- ============================================

-- 1. Primeiro, verificar se o índice existe
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'broadcast_queue'
  AND indexname = 'unique_phone_campaign_instance_active_idx';

-- 2. Ver uma mensagem existente para usar como base do teste
SELECT
  id,
  phone,
  campaign_id,
  instance_id,
  status
FROM broadcast_queue
WHERE status IN ('pending', 'scheduled', 'sending')
LIMIT 1;

-- 3. Tentar criar uma duplicata (deve falhar se índice estiver funcionando)
-- ⚠️ ATENÇÃO: Substitua os valores abaixo pelos valores reais da query acima
-- ⚠️ Este INSERT deve FALHAR se o índice estiver funcionando corretamente
/*
INSERT INTO broadcast_queue (
  phone,
  campaign_id,
  instance_id,
  status,
  scheduled_for,
  created_at
)
VALUES (
  '21966224051',  -- Substitua pelo phone da query acima
  'campaign-id-aqui',  -- Substitua pelo campaign_id da query acima
  'instance-id-aqui',  -- Substitua pelo instance_id da query acima
  'scheduled',
  NOW(),
  NOW()
);
*/

-- 4. Verificar mensagens duplicadas existentes (se houver)
SELECT
  phone,
  campaign_id,
  instance_id,
  COUNT(*) as total
FROM broadcast_queue
WHERE status IN ('pending', 'scheduled', 'sending')
GROUP BY phone, campaign_id, instance_id
HAVING COUNT(*) > 1;

-- ============================================
-- Corrigir Campanhas que Não Têm scheduled_start_at
-- ============================================
-- Este script mostra campanhas que foram criadas sem scheduled_start_at
-- e permite atualizar manualmente se necessário
-- ============================================

-- 1. Verificar campanhas sem scheduled_start_at (últimas 24h)
SELECT 
  id,
  name,
  status,
  scheduled_start_at,
  created_at,
  '❌ Esta campanha foi criada ANTES do deploy do frontend' as problema
FROM broadcast_campaigns
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND scheduled_start_at IS NULL
ORDER BY created_at DESC;

-- 2. Se você quiser DELETAR campanhas antigas sem agendamento:
-- (Descomente as linhas abaixo se quiser deletar)
/*
DELETE FROM broadcast_campaigns
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND scheduled_start_at IS NULL
  AND status = 'draft';
*/

-- ============================================
-- IMPORTANTE:
-- ============================================
-- 1. Faça deploy do frontend: ./scripts/deploy-zero-downtime.sh
-- 2. Crie uma NOVA campanha após o deploy
-- 3. A nova campanha terá scheduled_start_at salvo corretamente
-- ============================================

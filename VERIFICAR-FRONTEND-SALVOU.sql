-- ============================================
-- Verificar se Frontend Salvou scheduled_start_at
-- ============================================
-- Este script verifica se o problema é que o frontend não salvou
-- ============================================

-- 1. Verificar TODAS as campanhas criadas nas últimas 24 horas
SELECT 
  id,
  name,
  status,
  scheduled_start_at,
  created_at,
  CASE 
    WHEN scheduled_start_at IS NULL THEN '❌ PROBLEMA: Frontend NÃO salvou scheduled_start_at!'
    WHEN scheduled_start_at IS NOT NULL THEN '✅ Frontend salvou corretamente'
  END as diagnostico,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 as minutos_desde_criacao
FROM broadcast_campaigns
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 2. Verificar se há campanhas com status 'draft' sem scheduled_start_at
SELECT 
  'Campanhas Draft sem Agendamento' as tipo,
  COUNT(*) as total,
  STRING_AGG(name, ', ') as nomes
FROM broadcast_campaigns
WHERE status = 'draft'
  AND scheduled_start_at IS NULL
  AND created_at > NOW() - INTERVAL '24 hours';

-- 3. Verificar última campanha criada (detalhes completos)
SELECT 
  'Última Campanha Criada' as tipo,
  id,
  name,
  status,
  scheduled_start_at,
  started_at,
  created_at,
  user_id,
  organization_id
FROM broadcast_campaigns
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 1;

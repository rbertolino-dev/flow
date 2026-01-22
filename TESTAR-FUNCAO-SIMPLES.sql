-- ============================================
-- Teste Simples da Função
-- ============================================
-- Teste direto para ver resposta completa
-- ============================================

-- 1. Verificar se query encontra a campanha
SELECT 
  id,
  name,
  status,
  scheduled_start_at,
  NOW() as agora,
  scheduled_start_at <= NOW() as deve_processar
FROM broadcast_campaigns
WHERE status = 'draft'
  AND scheduled_start_at IS NOT NULL
  AND scheduled_start_at <= NOW()
ORDER BY scheduled_start_at ASC;

-- 2. Testar função (mostra resposta completa)
SELECT 
  net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-scheduled-campaigns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm'
    ),
    body := '{}'::jsonb
  ) as resultado;

-- 3. Aguardar 3 segundos e verificar status
SELECT 
  id,
  name,
  status,
  scheduled_start_at,
  started_at
FROM broadcast_campaigns
WHERE id = 'de3e4282-d7ff-48ed-ab9c-5f9210f5be80';

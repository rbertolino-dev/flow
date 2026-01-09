-- ==========================================
-- ANÁLISE PROFUNDA: Campanhas "iclass sistemas" não sendo disparadas
-- ==========================================
-- Execute no Supabase SQL Editor
-- ==========================================

-- 1. IDENTIFICAR ORGANIZAÇÃO "iclass sistemas"
SELECT 
  '🔍 Organização encontrada' as tipo,
  id as organization_id,
  name as nome_organizacao,
  created_at
FROM public.organizations
WHERE LOWER(name) LIKE '%iclass%' OR LOWER(name) LIKE '%sistemas%'
ORDER BY created_at DESC;

-- 2. CAMPANHAS DA ORGANIZAÇÃO "iclass sistemas"
SELECT 
  '📊 Campanhas da organização' as tipo,
  bc.id as campaign_id,
  bc.name as nome_campanha,
  bc.status as status_campanha,
  bc.created_at as criada_em,
  bc.sent_count as enviadas,
  bc.failed_count as falhas,
  bc.total_contacts as total,
  bc.instance_id,
  ec.instance_name,
  CASE 
    WHEN bc.status = 'running' AND bc.sent_count = 0 THEN '⚠️ Rodando mas sem envios'
    WHEN bc.status = 'draft' THEN '📝 Rascunho'
    WHEN bc.status = 'paused' THEN '⏸️ Pausada'
    WHEN bc.status = 'cancelled' THEN '❌ Cancelada'
    WHEN bc.status = 'completed' THEN '✅ Concluída'
    ELSE '❓ Status desconhecido'
  END as diagnostico
FROM public.broadcast_campaigns bc
LEFT JOIN public.evolution_config ec ON ec.id = bc.instance_id
WHERE bc.organization_id IN (
  SELECT id FROM public.organizations 
  WHERE LOWER(name) LIKE '%iclass%' OR LOWER(name) LIKE '%sistemas%'
)
ORDER BY bc.created_at DESC;

-- 3. MENSAGENS AGENDADAS QUE NÃO FORAM DISPARADAS (CRÍTICO!)
SELECT 
  '🚨 MENSAGENS AGENDADAS NÃO DISPARADAS' as tipo,
  bq.id as queue_id,
  bc.id as campaign_id,
  bc.name as nome_campanha,
  bc.status as status_campanha,
  bq.status as status_fila,
  bq.scheduled_for as agendado_para,
  NOW() as agora,
  EXTRACT(EPOCH FROM (NOW() - bq.scheduled_for)) / 60 as minutos_atrasado,
  bq.phone as telefone,
  bq.name as nome_contato,
  bq.instance_id,
  ec.instance_name,
  ec.api_url,
  CASE 
    WHEN bq.instance_id IS NULL THEN '❌ SEM INSTÂNCIA CONFIGURADA'
    WHEN ec.id IS NULL THEN '❌ INSTÂNCIA NÃO EXISTE'
    WHEN bc.status = 'cancelled' THEN '❌ CAMPANHA CANCELADA'
    WHEN bc.status = 'paused' THEN '⏸️ CAMPANHA PAUSADA'
    WHEN bq.scheduled_for > NOW() THEN '⏰ AINDA NÃO É HORA (futuro)'
    WHEN bq.scheduled_for <= NOW() AND bq.status = 'scheduled' THEN '🚨 DEVERIA TER SIDO DISPARADA!'
    ELSE '❓ Status desconhecido'
  END as diagnostico
FROM public.broadcast_queue bq
JOIN public.broadcast_campaigns bc ON bc.id = bq.campaign_id
LEFT JOIN public.evolution_config ec ON ec.id = bq.instance_id
WHERE bc.organization_id IN (
  SELECT id FROM public.organizations 
  WHERE LOWER(name) LIKE '%iclass%' OR LOWER(name) LIKE '%sistemas%'
)
AND bq.status = 'scheduled'
ORDER BY bq.scheduled_for ASC;

-- 4. MENSAGENS COM scheduled_for NO PASSADO MAS AINDA "scheduled" (PROBLEMA!)
SELECT 
  '⏰ Mensagens atrasadas não disparadas' as tipo,
  COUNT(*) as total_mensagens_atrasadas,
  MIN(bq.scheduled_for) as primeira_mensagem_atrasada,
  MAX(bq.scheduled_for) as ultima_mensagem_atrasada,
  AVG(EXTRACT(EPOCH FROM (NOW() - bq.scheduled_for)) / 60) as minutos_atrasado_medio,
  bc.id as campaign_id,
  bc.name as nome_campanha,
  bc.status as status_campanha
FROM public.broadcast_queue bq
JOIN public.broadcast_campaigns bc ON bc.id = bq.campaign_id
WHERE bc.organization_id IN (
  SELECT id FROM public.organizations 
  WHERE LOWER(name) LIKE '%iclass%' OR LOWER(name) LIKE '%sistemas%'
)
AND bq.status = 'scheduled'
AND bq.scheduled_for <= NOW()
GROUP BY bc.id, bc.name, bc.status
ORDER BY minutos_atrasado_medio DESC;

-- 5. VERIFICAR SE HÁ INSTÂNCIAS CONFIGURADAS PARA A ORGANIZAÇÃO
SELECT 
  '🔧 Instâncias configuradas' as tipo,
  ec.id as instance_id,
  ec.instance_name,
  ec.api_url,
  ec.organization_id,
  o.name as organizacao,
  CASE 
    WHEN ec.api_url IS NULL OR ec.api_url = '' THEN '❌ SEM API URL'
    WHEN ec.api_key IS NULL OR ec.api_key = '' THEN '❌ SEM API KEY'
    WHEN ec.instance_name IS NULL OR ec.instance_name = '' THEN '❌ SEM NOME DA INSTÂNCIA'
    ELSE '✅ Configurada'
  END as status_configuracao
FROM public.evolution_config ec
JOIN public.organizations o ON o.id = ec.organization_id
WHERE ec.organization_id IN (
  SELECT id FROM public.organizations 
  WHERE LOWER(name) LIKE '%iclass%' OR LOWER(name) LIKE '%sistemas%'
)
ORDER BY ec.created_at DESC;

-- 6. MENSAGENS SEM INSTÂNCIA CONFIGURADA (PROBLEMA CRÍTICO!)
SELECT 
  '❌ Mensagens sem instância' as tipo,
  COUNT(*) as total_sem_instancia,
  bc.id as campaign_id,
  bc.name as nome_campanha,
  bc.instance_id as instance_id_campanha,
  COUNT(DISTINCT bq.instance_id) as instancias_diferentes_na_fila
FROM public.broadcast_queue bq
JOIN public.broadcast_campaigns bc ON bc.id = bq.campaign_id
WHERE bc.organization_id IN (
  SELECT id FROM public.organizations 
  WHERE LOWER(name) LIKE '%iclass%' OR LOWER(name) LIKE '%sistemas%'
)
AND bq.status = 'scheduled'
AND (bq.instance_id IS NULL OR bq.instance_id NOT IN (SELECT id FROM public.evolution_config))
GROUP BY bc.id, bc.name, bc.instance_id
HAVING COUNT(*) > 0;

-- 7. RESUMO GERAL DA SITUAÇÃO
SELECT 
  '📊 RESUMO GERAL' as tipo,
  COUNT(DISTINCT bc.id) as total_campanhas,
  COUNT(DISTINCT CASE WHEN bc.status = 'running' THEN bc.id END) as campanhas_rodando,
  COUNT(DISTINCT CASE WHEN bc.status = 'draft' THEN bc.id END) as campanhas_rascunho,
  COUNT(DISTINCT CASE WHEN bc.status = 'paused' THEN bc.id END) as campanhas_pausadas,
  COUNT(DISTINCT CASE WHEN bc.status = 'cancelled' THEN bc.id END) as campanhas_canceladas,
  COUNT(DISTINCT CASE WHEN bc.status = 'completed' THEN bc.id END) as campanhas_concluidas,
  COUNT(*) FILTER (WHERE bq.status = 'scheduled' AND bq.scheduled_for <= NOW()) as mensagens_atrasadas_nao_disparadas,
  COUNT(*) FILTER (WHERE bq.status = 'scheduled' AND bq.scheduled_for > NOW()) as mensagens_agendadas_futuro,
  COUNT(*) FILTER (WHERE bq.status = 'sent') as mensagens_enviadas,
  COUNT(*) FILTER (WHERE bq.status = 'failed') as mensagens_falhadas,
  COUNT(*) FILTER (WHERE bq.instance_id IS NULL) as mensagens_sem_instancia
FROM public.broadcast_campaigns bc
LEFT JOIN public.broadcast_queue bq ON bq.campaign_id = bc.id
WHERE bc.organization_id IN (
  SELECT id FROM public.organizations 
  WHERE LOWER(name) LIKE '%iclass%' OR LOWER(name) LIKE '%sistemas%'
);

-- 8. VERIFICAR SE CRON JOB ESTÁ CONFIGURADO (verificar manualmente no Supabase Dashboard)
-- Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/database/extensions
-- Procure por "pg_cron" e verifique se está habilitado
-- Depois verifique os jobs em: Database > Cron Jobs

-- 9. VERIFICAR ÚLTIMAS EXECUÇÕES DO PROCESS-BROADCAST-QUEUE
-- Verificar logs da edge function no Supabase Dashboard:
-- Edge Functions > process-broadcast-queue > Logs

-- ==========================================
-- DIAGNÓSTICO AUTOMÁTICO
-- ==========================================
-- Execute esta query para obter diagnóstico resumido:
SELECT 
  CASE 
    WHEN COUNT(*) FILTER (WHERE bq.status = 'scheduled' AND bq.scheduled_for <= NOW()) > 0 
      AND COUNT(*) FILTER (WHERE bq.instance_id IS NULL) = 0
      AND COUNT(*) FILTER (WHERE bc.status IN ('cancelled', 'paused')) = 0
    THEN '🚨 PROBLEMA: Mensagens agendadas no passado não foram disparadas. Verifique se o cron job está rodando!'
    
    WHEN COUNT(*) FILTER (WHERE bq.instance_id IS NULL) > 0
    THEN '❌ PROBLEMA: Mensagens sem instância configurada. Configure instâncias para a organização.'
    
    WHEN COUNT(*) FILTER (WHERE bc.status = 'cancelled') > 0
    THEN '⚠️ ATENÇÃO: Algumas campanhas estão canceladas. Mensagens dessas campanhas não serão disparadas.'
    
    WHEN COUNT(*) FILTER (WHERE bc.status = 'paused') > 0
    THEN '⏸️ ATENÇÃO: Algumas campanhas estão pausadas. Mensagens dessas campanhas não serão disparadas.'
    
    WHEN COUNT(*) FILTER (WHERE ec.id IS NULL) > 0
    THEN '❌ PROBLEMA: Organização não tem instâncias configuradas. Configure pelo menos uma instância.'
    
    ELSE '✅ Tudo parece estar configurado corretamente. Verifique logs da edge function process-broadcast-queue.'
  END as diagnostico_principal
FROM public.broadcast_campaigns bc
LEFT JOIN public.broadcast_queue bq ON bq.campaign_id = bc.id
LEFT JOIN public.evolution_config ec ON ec.organization_id = bc.organization_id
WHERE bc.organization_id IN (
  SELECT id FROM public.organizations 
  WHERE LOWER(name) LIKE '%iclass%' OR LOWER(name) LIKE '%sistemas%'
);


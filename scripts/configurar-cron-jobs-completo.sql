-- ============================================
-- CONFIGURAÇÃO DE CRON JOBS PARA SUPABASE
-- ============================================
-- Este script configura todos os cron jobs necessários
-- para as Edge Functions que precisam rodar periodicamente
--
-- IMPORTANTE: 
-- 1. Substituir [SERVICE_ROLE_KEY] pela chave real (obter do Dashboard)
-- 2. PROJECT_URL já está configurado: https://ogeljmbhqxpfjbpnbwog.supabase.co
-- 3. Executar após aplicar todas as migrations
-- ============================================

-- Habilitar extensão pg_cron (se ainda não estiver)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Habilitar extensão net.http (necessária para chamar Edge Functions)
CREATE EXTENSION IF NOT EXISTS http;

-- ============================================
-- NOTA: Substituir [SERVICE_ROLE_KEY] abaixo
-- ============================================
-- Obter Service Role Key de:
-- Dashboard → Settings → API → service_role (secret)
-- ============================================

-- ============================================
-- 1. SYNC DAILY METRICS (Meia-noite)
-- ============================================
-- Sincroniza métricas diárias do sistema
SELECT cron.schedule(
  'sync-daily-metrics',
  '0 0 * * *', -- Todo dia à meia-noite
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/sync-daily-metrics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 2. PROCESS WHATSAPP WORKFLOWS (A cada 5 minutos)
-- ============================================
-- Processa workflows do WhatsApp pendentes
SELECT cron.schedule(
  'process-whatsapp-workflows',
  '*/5 * * * *', -- A cada 5 minutos
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-whatsapp-workflows',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 3. PROCESS BROADCAST QUEUE (A cada minuto)
-- ============================================
-- Processa fila de broadcast de mensagens
SELECT cron.schedule(
  'process-broadcast-queue',
  '*/1 * * * *', -- A cada minuto
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-broadcast-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 4. PROCESS SCHEDULED MESSAGES (A cada minuto)
-- ============================================
-- Processa mensagens agendadas
SELECT cron.schedule(
  'process-scheduled-messages',
  '*/1 * * * *', -- A cada minuto
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-scheduled-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 5. PROCESS STATUS SCHEDULE (A cada 5 minutos)
-- ============================================
-- Processa agendamento de status do WhatsApp
SELECT cron.schedule(
  'process-status-schedule',
  '*/5 * * * *', -- A cada 5 minutos
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-status-schedule',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 6. SYNC GOOGLE CALENDAR EVENTS (A cada 15 minutos)
-- ============================================
-- Sincroniza eventos do Google Calendar
SELECT cron.schedule(
  'sync-google-calendar-events',
  '*/15 * * * *', -- A cada 15 minutos
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/sync-google-calendar-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 7. PROCESS GOOGLE BUSINESS POSTS (A cada 30 minutos)
-- ============================================
-- Processa posts do Google Business
SELECT cron.schedule(
  'process-google-business-posts',
  '*/30 * * * *', -- A cada 30 minutos
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-google-business-posts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- VERIFICAR CRON JOBS CONFIGURADOS
-- ============================================
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
ORDER BY jobid;

-- ============================================
-- COMANDOS ÚTEIS
-- ============================================

-- Listar todos os cron jobs:
-- SELECT * FROM cron.job;

-- Desabilitar um cron job:
-- SELECT cron.unschedule('nome-do-job');

-- Habilitar um cron job:
-- UPDATE cron.job SET active = true WHERE jobname = 'nome-do-job';

-- Ver histórico de execuções:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- ============================================
-- NOTAS
-- ============================================
-- 1. No Supabase Cloud, pg_cron pode ter limitações
-- 2. Verificar se extensão net.http está habilitada
-- 3. Ajustar frequências conforme necessidade
-- 4. Monitorar logs para verificar execuções
-- 5. Em caso de erro, verificar Service Role Key
-- 6. Substituir [SERVICE_ROLE_KEY] pela chave real antes de executar




-- ============================================
-- CONFIGURAÇÃO DE CRON JOBS PARA SUPABASE (CORRIGIDO)
-- ============================================
-- Este script configura todos os cron jobs necessários
-- para as Edge Functions que precisam rodar periodicamente
--
-- CORREÇÃO: Usando pg_net ao invés de http (net.http_post)
-- ============================================

-- Habilitar extensão pg_cron (se ainda não estiver)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Habilitar extensão pg_net (necessária para chamar Edge Functions)
-- No Supabase Cloud, use pg_net ao invés de http
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- NOTA: Se pg_net não estiver disponível, use esta alternativa:
-- ============================================
-- Os cron jobs podem ser configurados para chamar Edge Functions
-- diretamente via HTTP usando a extensão pg_net ou via curl externo
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
      'Authorization', 'Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm'
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
      'Authorization', 'Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm'
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
      'Authorization', 'Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm'
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
      'Authorization', 'Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm'
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
      'Authorization', 'Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm'
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
      'Authorization', 'Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm'
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
      'Authorization', 'Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm'
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




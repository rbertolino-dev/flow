-- ============================================
-- DEPLOY SIMPLES: CAMPANHAS AGENDADAS
-- ============================================
-- Versão simplificada que funciona com certeza
-- Execute este arquivo no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
-- ============================================

-- ============================================
-- PASSO 1: Habilitar Extensões
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- ============================================
-- PASSO 2: Adicionar Coluna scheduled_start_at
-- ============================================
ALTER TABLE public.broadcast_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_scheduled_start 
  ON public.broadcast_campaigns(scheduled_start_at) 
  WHERE scheduled_start_at IS NOT NULL AND status = 'draft';

COMMENT ON COLUMN public.broadcast_campaigns.scheduled_start_at IS 'Data e hora agendada para início automático da campanha. Quando chegar este horário, a campanha será iniciada automaticamente pelo processo de verificação.';

-- ============================================
-- PASSO 3: Remover Cron Job Antigo (se existir)
-- ============================================
-- Usa bloco DO para não dar erro se não existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-campaigns') THEN
    PERFORM cron.unschedule('process-scheduled-campaigns');
  END IF;
END $$;

-- ============================================
-- PASSO 4: Criar Cron Job
-- ============================================
SELECT cron.schedule(
  'process-scheduled-campaigns',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-scheduled-campaigns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- VERIFICAÇÕES
-- ============================================
-- Verificar coluna
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'broadcast_campaigns'
  AND column_name = 'scheduled_start_at';

-- Verificar cron job
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job 
WHERE jobname = 'process-scheduled-campaigns';

-- ============================================
-- DEPLOY FINAL: CAMPANHAS AGENDADAS
-- ============================================
-- Versão corrigida que não dá erro mesmo se job não existir
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
  -- Verificar se existe antes de remover
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-campaigns') THEN
    PERFORM cron.unschedule('process-scheduled-campaigns');
    RAISE NOTICE '✅ Cron job antigo removido';
  ELSE
    RAISE NOTICE 'ℹ️  Cron job não existe ainda, será criado';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignorar erros (job pode não existir)
    RAISE NOTICE 'ℹ️  Nenhum cron job antigo para remover';
END $$;

-- ============================================
-- PASSO 4: Criar Cron Job
-- ============================================
SELECT cron.schedule(
  'process-scheduled-campaigns',
  '*/1 * * * *', -- A cada minuto
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

-- Verificar se coluna foi criada
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'broadcast_campaigns'
  AND column_name = 'scheduled_start_at';

-- Verificar se cron job foi criado
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN command LIKE '%sb_publishable%' THEN '⚠️ Usando chave publishable'
    WHEN command LIKE '%Bearer eyJ%' THEN '✅ Usando chave JWT (correto)'
    ELSE '✅ Cron job criado'
  END as status_chave
FROM cron.job 
WHERE jobname = 'process-scheduled-campaigns';

-- ============================================
-- PRÓXIMO PASSO: Deploy da Edge Function
-- ============================================
-- Edge Function: process-scheduled-campaigns
-- URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions/process-scheduled-campaigns
-- 
-- Faça deploy da edge function antes de testar!
-- ============================================

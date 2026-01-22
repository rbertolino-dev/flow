-- ============================================
-- DEPLOY COMPLETO: CAMPANHAS AGENDADAS
-- ============================================
-- Execute este arquivo no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
-- ============================================

-- ============================================
-- PASSO 1: Aplicar Migration
-- ============================================
-- Adiciona coluna scheduled_start_at na tabela broadcast_campaigns

ALTER TABLE public.broadcast_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_scheduled_start 
  ON public.broadcast_campaigns(scheduled_start_at) 
  WHERE scheduled_start_at IS NOT NULL AND status = 'draft';

COMMENT ON COLUMN public.broadcast_campaigns.scheduled_start_at IS 'Data e hora agendada para início automático da campanha. Quando chegar este horário, a campanha será iniciada automaticamente pelo processo de verificação.';

-- ============================================
-- PASSO 2: Habilitar Extensões (se necessário)
-- ============================================
-- Garantir que extensões necessárias estão habilitadas

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- ============================================
-- PASSO 3: Configurar Cron Job
-- ============================================
-- Cria cron job para verificar e iniciar campanhas agendadas a cada minuto

-- Remover cron job antigo se existir (evita duplicação)
-- Usa bloco DO com EXCEPTION para não dar erro se não existir
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
    -- Ignorar erros (job pode não existir ou já foi removido)
    RAISE NOTICE 'ℹ️  Nenhum cron job antigo para remover';
END $$;

-- Criar novo cron job
-- ⚠️ NOTA: Usando a mesma chave dos outros cron jobs do projeto
-- Se precisar trocar, substitua 'sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm'
-- pela SERVICE_ROLE_KEY real do Supabase Dashboard
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
    WHEN command LIKE '%sb_publishable%' THEN '⚠️ Usando chave publishable (pode funcionar, mas SERVICE_ROLE_KEY é recomendado)'
    WHEN command LIKE '%Bearer eyJ%' THEN '✅ Usando chave JWT (correto)'
    ELSE '✅ Cron job criado'
  END as status_chave
FROM cron.job 
WHERE jobname = 'process-scheduled-campaigns';

-- ============================================
-- PRÓXIMO PASSO: Deploy da Edge Function
-- ============================================
-- Após executar este SQL, faça deploy da edge function:
-- 
-- Opção 1: Via Supabase Dashboard
-- https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions
-- Clique em "Deploy" na função process-scheduled-campaigns
--
-- Opção 2: Via CLI
-- cd /root/kanban-buzz-95241
-- supabase functions deploy process-scheduled-campaigns --project-ref ogeljmbhqxpfjbpnbwog
-- ============================================

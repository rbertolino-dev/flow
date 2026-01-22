-- ============================================
-- Verificar Configuração de Campanhas Agendadas
-- ============================================
-- Execute este script no Supabase SQL Editor para verificar
-- se tudo está configurado corretamente
-- ============================================

-- 1. Verificar se coluna scheduled_start_at existe
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'broadcast_campaigns'
  AND column_name = 'scheduled_start_at';

-- 2. Verificar se índice existe
SELECT 
  indexname, 
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'broadcast_campaigns'
  AND indexname LIKE '%scheduled_start%';

-- 3. Verificar se cron job existe
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job 
WHERE jobname = 'process-scheduled-campaigns';

-- 4. Verificar últimas execuções do cron job
SELECT 
  start_time,
  end_time,
  status,
  return_message,
  jobid
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-scheduled-campaigns')
ORDER BY start_time DESC 
LIMIT 10;

-- 5. Verificar se extensões estão habilitadas
SELECT 
  extname, 
  extversion
FROM pg_extension 
WHERE extname IN ('pg_cron', 'http');

-- 6. Verificar campanhas agendadas (se houver)
SELECT 
  id,
  name,
  status,
  scheduled_start_at,
  created_at
FROM broadcast_campaigns
WHERE scheduled_start_at IS NOT NULL
ORDER BY scheduled_start_at DESC
LIMIT 5;

-- ============================================
-- RESULTADO ESPERADO:
-- ============================================
-- 1. Coluna scheduled_start_at: Deve existir (tipo: timestamp with time zone)
-- 2. Índice: Deve existir (idx_broadcast_campaigns_scheduled_start)
-- 3. Cron job: Deve existir e estar ativo (active = true)
-- 4. Execuções: Deve mostrar execuções recentes (a cada minuto)
-- 5. Extensões: pg_cron e http devem estar habilitadas
-- 6. Campanhas: Pode estar vazio (normal se não houver campanhas agendadas)
-- ============================================

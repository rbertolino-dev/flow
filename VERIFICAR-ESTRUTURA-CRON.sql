-- Verificar estrutura da tabela cron.job_run_details
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'cron'
  AND table_name = 'job_run_details'
ORDER BY ordinal_position;

-- ============================================
-- FIX: Garantir que Realtime está habilitado para pipeline_stages e leads
-- ============================================

-- Garantir REPLICA IDENTITY FULL (necessário para realtime)
DO $$
BEGIN
  -- pipeline_stages
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pipeline_stages') THEN
    ALTER TABLE public.pipeline_stages REPLICA IDENTITY FULL;
    RAISE NOTICE 'REPLICA IDENTITY FULL configurado para pipeline_stages';
  END IF;

  -- leads
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
    ALTER TABLE public.leads REPLICA IDENTITY FULL;
    RAISE NOTICE 'REPLICA IDENTITY FULL configurado para leads';
  END IF;
END $$;

-- Garantir que tabelas estão na publicação supabase_realtime
DO $$
BEGIN
  -- pipeline_stages
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pipeline_stages') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'pipeline_stages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_stages;
      RAISE NOTICE 'pipeline_stages adicionada à publicação supabase_realtime';
    ELSE
      RAISE NOTICE 'pipeline_stages já está na publicação supabase_realtime';
    END IF;
  END IF;

  -- leads
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'leads'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
      RAISE NOTICE 'leads adicionada à publicação supabase_realtime';
    ELSE
      RAISE NOTICE 'leads já está na publicação supabase_realtime';
    END IF;
  END IF;
END $$;

-- Verificar status final
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN relreplident = 'f' THEN 'FULL'
    WHEN relreplident = 'd' THEN 'DEFAULT'
    WHEN relreplident = 'n' THEN 'NOTHING'
    WHEN relreplident = 'i' THEN 'INDEX'
    ELSE 'UNKNOWN'
  END as replica_identity,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = t.schemaname 
      AND tablename = t.tablename
    ) THEN 'ENABLED'
    ELSE 'DISABLED'
  END as realtime_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public' 
  AND t.tablename IN ('pipeline_stages', 'leads')
ORDER BY t.tablename;



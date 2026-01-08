-- Garantir que realtime está habilitado para pipeline_stages
-- Necessário para atualizações em tempo real funcionarem

-- 1. Garantir REPLICA IDENTITY FULL (necessário para realtime UPDATE)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'pipeline_stages'
  ) THEN
    -- Verificar se já está configurado
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'pipeline_stages'
        AND c.relreplident = 'f'  -- 'f' = FULL
    ) THEN
      ALTER TABLE public.pipeline_stages REPLICA IDENTITY FULL;
      RAISE NOTICE 'REPLICA IDENTITY FULL configurado para pipeline_stages';
    ELSE
      RAISE NOTICE 'pipeline_stages já tem REPLICA IDENTITY FULL';
    END IF;
  END IF;
END $$;

-- 2. Garantir que pipeline_stages está na publicação supabase_realtime
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'pipeline_stages'
  ) THEN
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
END $$;

-- 3. Verificar status final
SELECT 
  'pipeline_stages' as table_name,
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
      AND schemaname = 'public' 
      AND tablename = 'pipeline_stages'
    ) THEN 'ENABLED'
    ELSE 'DISABLED'
  END as realtime_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relname = 'pipeline_stages';


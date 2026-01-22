-- Habilitar Realtime na tabela contracts
-- Necessário para que as subscriptions funcionem corretamente e atualizem contagem de categorias

-- 1. Garantir REPLICA IDENTITY FULL (necessário para realtime UPDATE)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'contracts'
  ) THEN
    -- Verificar se já está configurado
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'contracts'
        AND c.relreplident = 'f'  -- 'f' = FULL
    ) THEN
      ALTER TABLE public.contracts REPLICA IDENTITY FULL;
      RAISE NOTICE 'REPLICA IDENTITY FULL configurado para contracts';
    ELSE
      RAISE NOTICE 'contracts já tem REPLICA IDENTITY FULL';
    END IF;
  END IF;
END $$;

-- 2. Garantir que contracts está na publicação supabase_realtime
DO $$
BEGIN
  -- Verificar se a publicação existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
    RAISE NOTICE 'Publicação supabase_realtime criada';
  END IF;

  -- Adicionar contracts à publicação se ainda não estiver
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'contracts'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'contracts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.contracts;
      RAISE NOTICE 'contracts adicionada à publicação supabase_realtime';
    ELSE
      RAISE NOTICE 'contracts já está na publicação supabase_realtime';
    END IF;
  END IF;
END $$;

-- 3. Verificar status final
SELECT 
  'contracts' as table_name,
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
      AND tablename = 'contracts'
    ) THEN 'ENABLED'
    ELSE 'DISABLED'
  END as realtime_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relname = 'contracts';

-- Comentário para documentação
COMMENT ON TABLE public.contracts IS 'Tabela de contratos com Realtime habilitado para atualizações em tempo real da contagem de categorias';

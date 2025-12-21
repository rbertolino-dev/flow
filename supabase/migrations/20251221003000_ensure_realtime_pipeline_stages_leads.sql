-- ============================================
-- Garantir Realtime para pipeline_stages e leads
-- ============================================

-- Habilitar Realtime para pipeline_stages
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pipeline_stages') THEN
    -- Configurar REPLICA IDENTITY FULL (necessário para realtime)
    ALTER TABLE public.pipeline_stages REPLICA IDENTITY FULL;
    
    -- Adicionar à publicação se ainda não estiver
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'pipeline_stages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_stages;
      RAISE NOTICE 'Tabela pipeline_stages adicionada à publicação supabase_realtime';
    ELSE
      RAISE NOTICE 'Tabela pipeline_stages já está na publicação supabase_realtime';
    END IF;
  END IF;
END $$;

-- Habilitar Realtime para leads
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
    -- Configurar REPLICA IDENTITY FULL (necessário para realtime)
    ALTER TABLE public.leads REPLICA IDENTITY FULL;
    
    -- Adicionar à publicação se ainda não estiver
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'leads'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
      RAISE NOTICE 'Tabela leads adicionada à publicação supabase_realtime';
    ELSE
      RAISE NOTICE 'Tabela leads já está na publicação supabase_realtime';
    END IF;
  END IF;
END $$;

-- Habilitar Realtime para tags
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tags') THEN
    -- Configurar REPLICA IDENTITY FULL (necessário para realtime)
    ALTER TABLE public.tags REPLICA IDENTITY FULL;
    
    -- Adicionar à publicação se ainda não estiver
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'tags'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.tags;
      RAISE NOTICE 'Tabela tags adicionada à publicação supabase_realtime';
    ELSE
      RAISE NOTICE 'Tabela tags já está na publicação supabase_realtime';
    END IF;
  END IF;
END $$;

-- Verificar status final
DO $$
DECLARE
  pipeline_stages_enabled BOOLEAN;
  leads_enabled BOOLEAN;
  tags_enabled BOOLEAN;
BEGIN
  -- Verificar pipeline_stages
  SELECT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'pipeline_stages'
  ) INTO pipeline_stages_enabled;
  
  -- Verificar leads
  SELECT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'leads'
  ) INTO leads_enabled;
  
  -- Verificar tags
  SELECT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'tags'
  ) INTO tags_enabled;
  
  RAISE NOTICE 'Status do Realtime:';
  RAISE NOTICE '  - pipeline_stages: %', CASE WHEN pipeline_stages_enabled THEN 'HABILITADO' ELSE 'DESABILITADO' END;
  RAISE NOTICE '  - leads: %', CASE WHEN leads_enabled THEN 'HABILITADO' ELSE 'DESABILITADO' END;
  RAISE NOTICE '  - tags: %', CASE WHEN tags_enabled THEN 'HABILITADO' ELSE 'DESABILITADO' END;
END $$;


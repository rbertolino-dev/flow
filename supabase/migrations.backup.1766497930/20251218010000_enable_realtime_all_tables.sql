-- Habilitar Realtime para todas as tabelas usadas no sistema
-- Esta migration garante que todas as tabelas necessárias estejam habilitadas para Realtime

-- Tabelas principais já habilitadas (verificar se ainda estão)
DO $$
BEGIN
  -- whatsapp_messages
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_messages') THEN
    ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;
    
    -- Adicionar à publicação se ainda não estiver
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'whatsapp_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
    END IF;
  END IF;

  -- evolution_config
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evolution_config') THEN
    ALTER TABLE public.evolution_config REPLICA IDENTITY FULL;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'evolution_config'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.evolution_config;
    END IF;
  END IF;

  -- organization_limits (para useOrganizationFeatures)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_limits') THEN
    ALTER TABLE public.organization_limits REPLICA IDENTITY FULL;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'organization_limits'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.organization_limits;
    END IF;
  END IF;

  -- organization_members (para atualizações de membros)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_members') THEN
    ALTER TABLE public.organization_members REPLICA IDENTITY FULL;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'organization_members'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.organization_members;
    END IF;
  END IF;
END $$;

-- Verificar se a publicação supabase_realtime existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'Publicação supabase_realtime não encontrada. O Realtime pode não estar habilitado no projeto Supabase.';
  END IF;
END $$;






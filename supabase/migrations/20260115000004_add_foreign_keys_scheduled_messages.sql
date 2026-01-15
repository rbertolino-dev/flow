-- ============================================
-- Adicionar Foreign Keys para scheduled_messages
-- ============================================
-- Esta migration adiciona foreign keys que faltam:
-- 1. lead_id -> leads(id)
-- 2. instance_id -> evolution_config(id)
-- ============================================

-- Adicionar foreign key para lead_id se não existir
DO $$
BEGIN
  -- Verificar se constraint já existe
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
      AND table_name = 'scheduled_messages' 
      AND constraint_name = 'scheduled_messages_lead_id_fkey'
  ) THEN
    -- Adicionar foreign key para lead_id
    ALTER TABLE public.scheduled_messages
    ADD CONSTRAINT scheduled_messages_lead_id_fkey 
    FOREIGN KEY (lead_id) 
    REFERENCES public.leads(id) 
    ON DELETE CASCADE;
    
    RAISE NOTICE 'Foreign key scheduled_messages_lead_id_fkey criada com sucesso';
  ELSE
    RAISE NOTICE 'Foreign key scheduled_messages_lead_id_fkey já existe';
  END IF;
END $$;

-- Adicionar foreign key para instance_id se não existir
DO $$
BEGIN
  -- Verificar se constraint já existe
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
      AND table_name = 'scheduled_messages' 
      AND constraint_name = 'scheduled_messages_instance_id_fkey'
  ) THEN
    -- Adicionar foreign key para instance_id
    ALTER TABLE public.scheduled_messages
    ADD CONSTRAINT scheduled_messages_instance_id_fkey 
    FOREIGN KEY (instance_id) 
    REFERENCES public.evolution_config(id) 
    ON DELETE CASCADE;
    
    RAISE NOTICE 'Foreign key scheduled_messages_instance_id_fkey criada com sucesso';
  ELSE
    RAISE NOTICE 'Foreign key scheduled_messages_instance_id_fkey já existe';
  END IF;
END $$;

-- Forçar atualização do cache do PostgREST para reconhecer os relacionamentos
NOTIFY pgrst, 'reload schema';

-- Comentários para documentação
COMMENT ON CONSTRAINT scheduled_messages_lead_id_fkey ON public.scheduled_messages IS 'Foreign key para a tabela leads - permite joins automáticos';
COMMENT ON CONSTRAINT scheduled_messages_instance_id_fkey ON public.scheduled_messages IS 'Foreign key para a tabela evolution_config - permite joins automáticos';

-- Adicionar coluna source_instance_id na tabela leads se não existir
-- Esta coluna é usada para identificar a instância do WhatsApp que criou o lead

-- Verificar nome correto da tabela de referência
-- Pode ser evolution_config ou evolution_configs
DO $$
DECLARE
  ref_table_name TEXT;
BEGIN
  -- Verificar qual tabela existe
  SELECT table_name INTO ref_table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' 
    AND table_name IN ('evolution_config', 'evolution_configs')
  LIMIT 1;
  
  -- Se nenhuma tabela encontrada, usar evolution_configs como padrão
  IF ref_table_name IS NULL THEN
    ref_table_name := 'evolution_configs';
  END IF;
  
  -- Adicionar coluna source_instance_id se não existir
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'leads' 
      AND column_name = 'source_instance_id'
  ) THEN
    EXECUTE format('ALTER TABLE public.leads ADD COLUMN source_instance_id UUID REFERENCES public.%I(id) ON DELETE SET NULL', ref_table_name);
    
    -- Adicionar índice para melhor performance em queries
    CREATE INDEX IF NOT EXISTS idx_leads_source_instance_id 
    ON public.leads(source_instance_id);
    
    -- Adicionar comentário
    EXECUTE format('COMMENT ON COLUMN public.leads.source_instance_id IS %L', 'ID da instância do WhatsApp que criou este lead');
  END IF;
  
  -- Adicionar coluna source_instance_name se não existir
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'leads' 
      AND column_name = 'source_instance_name'
  ) THEN
    ALTER TABLE public.leads 
    ADD COLUMN source_instance_name TEXT;
    
    COMMENT ON COLUMN public.leads.source_instance_name IS 'Nome da instância do WhatsApp que criou este lead';
  END IF;
END $$;

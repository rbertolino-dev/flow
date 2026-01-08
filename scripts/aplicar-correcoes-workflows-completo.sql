-- ==========================================
-- CORREÇÕES COMPLETAS: group_id + cpf_cnpj
-- ==========================================
-- Execute este script no Supabase SQL Editor
-- https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

-- ==========================================
-- PARTE 1: Adicionar coluna group_id em whatsapp_workflows
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'whatsapp_workflows'
    AND column_name = 'group_id'
  ) THEN
    -- Verificar se tabela whatsapp_workflow_groups existe
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'whatsapp_workflow_groups'
    ) THEN
      -- Adicionar com foreign key se tabela existir
      ALTER TABLE public.whatsapp_workflows
      ADD COLUMN group_id uuid REFERENCES public.whatsapp_workflow_groups(id) ON DELETE SET NULL;
      
      RAISE NOTICE 'Coluna group_id adicionada com foreign key para whatsapp_workflow_groups';
    ELSE
      -- Adicionar sem foreign key se tabela não existir
      ALTER TABLE public.whatsapp_workflows
      ADD COLUMN group_id uuid;
      
      RAISE NOTICE 'Coluna group_id adicionada sem foreign key (tabela whatsapp_workflow_groups não existe)';
    END IF;
    
    -- Criar índice para performance
    CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_group_id 
    ON public.whatsapp_workflows(group_id);
    
    RAISE NOTICE 'Índice idx_whatsapp_workflows_group_id criado';
  ELSE
    RAISE NOTICE 'Coluna group_id já existe em whatsapp_workflows';
  END IF;
END $$;

-- ==========================================
-- PARTE 2: Adicionar coluna cpf_cnpj em leads
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'leads'
    AND column_name = 'cpf_cnpj'
  ) THEN
    ALTER TABLE public.leads
    ADD COLUMN cpf_cnpj TEXT;
    
    COMMENT ON COLUMN public.leads.cpf_cnpj IS 'CPF (11 dígitos) ou CNPJ (14 dígitos) do lead, apenas números';
    
    -- Criar índice para buscas
    CREATE INDEX IF NOT EXISTS idx_leads_cpf_cnpj 
    ON public.leads(cpf_cnpj) 
    WHERE cpf_cnpj IS NOT NULL;
    
    RAISE NOTICE 'Coluna cpf_cnpj adicionada em leads';
    RAISE NOTICE 'Índice idx_leads_cpf_cnpj criado';
  ELSE
    RAISE NOTICE 'Coluna cpf_cnpj já existe em leads';
  END IF;
END $$;

-- ==========================================
-- PARTE 3: Forçar atualização do schema cache do Supabase
-- ==========================================

NOTIFY pgrst, 'reload schema';

-- Aguardar um pouco para garantir que o schema foi atualizado
SELECT pg_sleep(1);

-- ==========================================
-- PARTE 4: Verificação final
-- ==========================================

DO $$
BEGIN
  -- Verificar group_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'whatsapp_workflows'
    AND column_name = 'group_id'
  ) THEN
    RAISE EXCEPTION 'Coluna group_id não foi criada!';
  END IF;
  
  -- Verificar cpf_cnpj
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'leads'
    AND column_name = 'cpf_cnpj'
  ) THEN
    RAISE EXCEPTION 'Coluna cpf_cnpj não foi criada!';
  END IF;
  
  RAISE NOTICE '✅ Verificação final: Todas as colunas foram criadas com sucesso!';
  RAISE NOTICE '✅ Schema cache será atualizado automaticamente';
END $$;



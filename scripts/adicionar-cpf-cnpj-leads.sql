-- ==========================================
-- ADICIONAR: Campo CPF/CNPJ em leads
-- ==========================================
-- Execute este script no Supabase SQL Editor
-- https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

-- Adicionar coluna cpf_cnpj se não existir
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

-- Forçar atualização do schema cache do Supabase
NOTIFY pgrst, 'reload schema';

-- Aguardar um pouco para garantir que o schema foi atualizado
SELECT pg_sleep(1);

-- Verificação final
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'leads'
    AND column_name = 'cpf_cnpj'
  ) THEN
    RAISE EXCEPTION 'Coluna cpf_cnpj não foi criada!';
  END IF;
  
  RAISE NOTICE '✅ Verificação final: Coluna cpf_cnpj existe em leads';
  RAISE NOTICE '✅ Schema cache será atualizado automaticamente';
END $$;


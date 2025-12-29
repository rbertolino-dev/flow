-- Migration idempotente para adicionar coluna return_date na tabela leads
-- Esta migration pode ser executada múltiplas vezes sem causar erros

-- Verificar se a coluna return_date já existe antes de adicionar
DO $$
BEGIN
    -- Verificar se a coluna não existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'leads' 
        AND column_name = 'return_date'
    ) THEN
        -- Adicionar coluna return_date do tipo date (nullable)
        ALTER TABLE public.leads 
        ADD COLUMN return_date DATE NULL;
        
        -- Adicionar comentário na coluna para documentação
        COMMENT ON COLUMN public.leads.return_date IS 'Data de retorno do lead para contato futuro';
        
        RAISE NOTICE 'Coluna return_date adicionada com sucesso à tabela leads';
    ELSE
        RAISE NOTICE 'Coluna return_date já existe na tabela leads, pulando criação';
    END IF;
END $$;


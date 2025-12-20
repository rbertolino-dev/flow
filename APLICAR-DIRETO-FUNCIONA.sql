-- SQL QUE FUNCIONA - APLICAR NO SUPABASE DASHBOARD
-- Link: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

-- Método direto (PostgreSQL 9.1+)
-- Se der erro de "already exists", ignore - significa que já foi adicionado
ALTER TYPE public.organization_feature ADD VALUE 'digital_contracts';

-- Verificar se foi adicionado
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_enum 
            WHERE enumlabel = 'digital_contracts'
            AND enumtypid = (
                SELECT oid 
                FROM pg_type 
                WHERE typname = 'organization_feature'
            )
        ) THEN '✅ SUCESSO: digital_contracts EXISTE'
        ELSE '❌ ERRO: digital_contracts NÃO EXISTE'
    END as resultado;

-- Verificar se digital_contracts existe no enum
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
        ) THEN '✅ SUCESSO: digital_contracts EXISTE no enum'
        ELSE '❌ ERRO: digital_contracts NÃO EXISTE'
    END as resultado;

-- Listar todos os valores do enum
SELECT enumlabel as "Valores do Enum organization_feature"
FROM pg_enum 
WHERE enumtypid = (
    SELECT oid 
    FROM pg_type 
    WHERE typname = 'organization_feature'
)
ORDER BY enumlabel;

-- ============================================
-- ADICIONAR FEATURE "digital_contracts" AO ENUM - VERSÃO FINAL
-- ============================================
-- Execute este SQL no Supabase SQL Editor

-- Método 1: Tentar adicionar diretamente (PostgreSQL 9.1+)
DO $$
BEGIN
    -- Verificar se já existe
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'digital_contracts'
        AND enumtypid = (
            SELECT oid 
            FROM pg_type 
            WHERE typname = 'organization_feature'
        )
    ) THEN
        -- Adicionar valor ao enum
        ALTER TYPE public.organization_feature ADD VALUE 'digital_contracts';
        RAISE NOTICE '✅ Valor digital_contracts adicionado ao enum organization_feature';
    ELSE
        RAISE NOTICE 'ℹ️  Valor digital_contracts já existe no enum';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Se falhar, tentar método alternativo
        RAISE NOTICE '⚠️  Método direto falhou, tentando método alternativo...';
END $$;

-- Método 2: Usar função auxiliar (mais seguro)
CREATE OR REPLACE FUNCTION public.add_enum_value_if_not_exists(
  _enum_type TEXT,
  _enum_value TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Verificar se o valor já existe no enum
  SELECT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = _enum_value
      AND enumtypid = (
        SELECT oid
        FROM pg_type
        WHERE typname = _enum_type
      )
  ) INTO v_exists;
  
  -- Se não existe, adicionar
  IF NOT v_exists THEN
    EXECUTE format('ALTER TYPE %I ADD VALUE %L', _enum_type, _enum_value);
    RAISE NOTICE '✅ Valor % adicionado ao enum %', _enum_value, _enum_type;
  ELSE
    RAISE NOTICE 'ℹ️  Valor % já existe no enum %', _enum_value, _enum_type;
  END IF;
END;
$$;

-- Adicionar "digital_contracts" ao enum organization_feature
DO $$
BEGIN
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'digital_contracts');
END $$;

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
        ) THEN '✅ SUCESSO: digital_contracts EXISTE no enum organization_feature'
        ELSE '❌ ERRO: digital_contracts NÃO EXISTE no enum'
    END as resultado;

-- Listar todos os valores do enum para confirmação
SELECT enumlabel as "Valores do Enum organization_feature"
FROM pg_enum 
WHERE enumtypid = (
    SELECT oid 
    FROM pg_type 
    WHERE typname = 'organization_feature'
)
ORDER BY enumlabel;

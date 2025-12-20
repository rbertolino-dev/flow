-- ============================================
-- MIGRAÇÃO: Adicionar Feature "digital_contracts" ao Enum
-- ============================================
-- Adiciona a funcionalidade "digital_contracts" ao enum organization_feature
-- para permitir controle de acesso ao módulo de contratos digitais

-- Função auxiliar para adicionar valor ao enum se não existir
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
  END IF;
END;
$$;

-- Adicionar "digital_contracts" ao enum organization_feature
DO $$
BEGIN
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'digital_contracts');
END $$;

-- Comentários para documentação
COMMENT ON TYPE public.organization_feature IS 'Enum de funcionalidades disponíveis para organizações. Inclui funcionalidades principais e integrações com sistemas externos.';


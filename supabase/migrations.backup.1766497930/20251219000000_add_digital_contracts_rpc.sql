-- Migration: Criar função RPC para adicionar digital_contracts ao enum
-- Esta função pode ser chamada via API REST

-- Criar função auxiliar se não existir
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
  
  IF NOT v_exists THEN
    EXECUTE format('ALTER TYPE %I ADD VALUE %L', _enum_type, _enum_value);
  END IF;
END;
$$;

-- Criar função RPC que adiciona digital_contracts
CREATE OR REPLACE FUNCTION public.add_digital_contracts_feature()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Usar função auxiliar para adicionar
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'digital_contracts');
  
  -- Verificar se foi adicionado
  IF EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'digital_contracts'
    AND enumtypid = (
      SELECT oid
      FROM pg_type
      WHERE typname = 'organization_feature'
    )
  ) THEN
    RETURN '✅ digital_contracts adicionado com sucesso ao enum organization_feature';
  ELSE
    RETURN '⚠️  digital_contracts não foi adicionado (pode já existir)';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RETURN '❌ Erro: ' || SQLERRM;
END;
$$;

-- Grant execute para todos os roles
GRANT EXECUTE ON FUNCTION public.add_digital_contracts_feature() TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_digital_contracts_feature() TO anon;
GRANT EXECUTE ON FUNCTION public.add_digital_contracts_feature() TO service_role;

-- Executar a função imediatamente para adicionar o valor
SELECT public.add_digital_contracts_feature();


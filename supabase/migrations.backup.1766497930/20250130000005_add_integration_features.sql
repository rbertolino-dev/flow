-- ============================================
-- MIGRAÇÃO: Adicionar Funcionalidades de Integração
-- ============================================
-- Adiciona novas funcionalidades ao enum para controlar acesso às integrações

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

-- Adicionar novos valores ao enum organization_feature
DO $$
BEGIN
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'calendar_integration');
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'gmail_integration');
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'payment_integration');
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'bubble_integration');
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'hubspot_integration');
  -- DESABILITADO: Chatwoot removido do projeto
  -- PERFORM public.add_enum_value_if_not_exists('organization_feature', 'chatwoot_integration');
END $$;

-- Remover função auxiliar (opcional, pode manter para uso futuro)
-- DROP FUNCTION IF EXISTS public.add_enum_value_if_not_exists(TEXT, TEXT);

-- Comentários para documentação
COMMENT ON TYPE public.organization_feature IS 'Enum de funcionalidades disponíveis para organizações. Inclui funcionalidades principais e integrações com sistemas externos.';


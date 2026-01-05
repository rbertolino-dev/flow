-- ============================================
-- Migration: Garantir que enabled_features e disabled_features sejam sempre arrays JSONB válidos
-- ============================================
-- Corrige dados corrompidos e garante que colunas JSONB sempre retornem arrays válidos

-- Primeiro, verificar e converter tipo das colunas se necessário
DO $$
DECLARE
  enabled_type TEXT;
  disabled_type TEXT;
BEGIN
  -- Verificar tipo de enabled_features
  SELECT data_type INTO enabled_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'organization_limits'
    AND column_name = 'enabled_features';
  
  -- Se for array de enums, converter para JSONB primeiro
  IF enabled_type = 'ARRAY' THEN
    -- Converter array para JSONB
    ALTER TABLE public.organization_limits
    ALTER COLUMN enabled_features TYPE JSONB
    USING to_jsonb(enabled_features);
  END IF;
  
  -- Verificar tipo de disabled_features
  SELECT data_type INTO disabled_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'organization_limits'
    AND column_name = 'disabled_features';
  
  -- Se for array de enums, converter para JSONB primeiro
  IF disabled_type = 'ARRAY' THEN
    -- Converter array para JSONB
    ALTER TABLE public.organization_limits
    ALTER COLUMN disabled_features TYPE JSONB
    USING to_jsonb(disabled_features);
  END IF;
END $$;

-- Função helper para normalizar JSONB para array
CREATE OR REPLACE FUNCTION public.normalize_jsonb_array(value JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Se for null, retornar array vazio
  IF value IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  
  -- Se já for array JSONB válido, retornar como está
  IF jsonb_typeof(value) = 'array' THEN
    RETURN value;
  END IF;
  
  -- Se for objeto, tentar converter valores para array
  IF jsonb_typeof(value) = 'object' THEN
    RETURN (
      SELECT jsonb_agg(elem)
      FROM jsonb_each(value) AS t(key, elem)
    );
  END IF;
  
  -- Se for string, tentar fazer parse
  IF jsonb_typeof(value) = 'string' THEN
    BEGIN
      RETURN value::text::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RETURN '[]'::jsonb;
    END;
  END IF;
  
  -- Caso padrão: array vazio
  RETURN '[]'::jsonb;
END;
$$;

-- Verificar tipo da coluna e converter se necessário
DO $$
DECLARE
  enabled_type TEXT;
  disabled_type TEXT;
BEGIN
  -- Verificar tipo de enabled_features
  SELECT data_type INTO enabled_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'organization_limits'
    AND column_name = 'enabled_features';
  
  -- Se for array de enums, converter para JSONB primeiro
  IF enabled_type = 'ARRAY' THEN
    -- Converter array para JSONB
    ALTER TABLE public.organization_limits
    ALTER COLUMN enabled_features TYPE JSONB
    USING to_jsonb(enabled_features);
  END IF;
  
  -- Verificar tipo de disabled_features
  SELECT data_type INTO disabled_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'organization_limits'
    AND column_name = 'disabled_features';
  
  -- Se for array de enums, converter para JSONB primeiro
  IF disabled_type = 'ARRAY' THEN
    -- Converter array para JSONB
    ALTER TABLE public.organization_limits
    ALTER COLUMN disabled_features TYPE JSONB
    USING to_jsonb(disabled_features);
  END IF;
END $$;

-- Atualizar todos os registros com dados inválidos (agora que são JSONB)
UPDATE public.organization_limits
SET 
  enabled_features = public.normalize_jsonb_array(enabled_features),
  disabled_features = public.normalize_jsonb_array(disabled_features)
WHERE 
  (enabled_features IS NOT NULL 
   AND jsonb_typeof(enabled_features) != 'array')
  OR (disabled_features IS NOT NULL 
      AND jsonb_typeof(disabled_features) != 'array');

-- Garantir que valores NULL sejam arrays vazios
UPDATE public.organization_limits
SET 
  enabled_features = '[]'::jsonb
WHERE enabled_features IS NULL;

UPDATE public.organization_limits
SET 
  disabled_features = '[]'::jsonb
WHERE disabled_features IS NULL;

-- Adicionar constraint para garantir que sempre seja array (se possível)
-- Nota: PostgreSQL não permite constraint CHECK em JSONB baseado em typeof, então vamos usar trigger

-- Trigger para validar e normalizar antes de INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.validate_organization_limits_jsonb()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Normalizar enabled_features
  NEW.enabled_features := public.normalize_jsonb_array(NEW.enabled_features);
  
  -- Normalizar disabled_features
  NEW.disabled_features := public.normalize_jsonb_array(NEW.disabled_features);
  
  RETURN NEW;
END;
$$;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trg_validate_organization_limits_jsonb ON public.organization_limits;

-- Criar trigger
CREATE TRIGGER trg_validate_organization_limits_jsonb
BEFORE INSERT OR UPDATE ON public.organization_limits
FOR EACH ROW
EXECUTE FUNCTION public.validate_organization_limits_jsonb();

-- Comentários
COMMENT ON FUNCTION public.normalize_jsonb_array(JSONB) IS 'Normaliza qualquer valor JSONB para um array JSONB válido';
COMMENT ON FUNCTION public.validate_organization_limits_jsonb() IS 'Valida e normaliza enabled_features e disabled_features antes de salvar';


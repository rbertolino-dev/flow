-- Adicionar colunas para controle de funcionalidades e trial
ALTER TABLE public.organization_limits 
ADD COLUMN IF NOT EXISTS enabled_features jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS disabled_features jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS features_override_mode text DEFAULT 'inherit'::text;

-- Comentários para documentação
COMMENT ON COLUMN public.organization_limits.enabled_features IS 'Funcionalidades extras habilitadas além do plano (override)';
COMMENT ON COLUMN public.organization_limits.disabled_features IS 'Funcionalidades do plano desabilitadas (override)';
COMMENT ON COLUMN public.organization_limits.trial_ends_at IS 'Data fim do período trial (acesso completo temporário)';
COMMENT ON COLUMN public.organization_limits.features_override_mode IS 'inherit=herda do plano, override=usa apenas enabled_features';

-- Criar função para verificar se organização tem acesso a uma feature
CREATE OR REPLACE FUNCTION public.organization_has_feature(
  _organization_id uuid,
  _feature text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits record;
  v_plan_features jsonb;
  v_is_in_trial boolean;
BEGIN
  -- Buscar limites da organização
  SELECT ol.*, p.features as plan_features
  INTO v_limits
  FROM organization_limits ol
  LEFT JOIN plans p ON ol.plan_id = p.id
  WHERE ol.organization_id = _organization_id;
  
  -- Se não tem registro, assume acesso negado
  IF v_limits IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verificar se está em período trial (acesso completo)
  v_is_in_trial := v_limits.trial_ends_at IS NOT NULL AND v_limits.trial_ends_at > now();
  IF v_is_in_trial THEN
    -- Durante trial, só bloqueia se estiver explicitamente desabilitado
    IF v_limits.disabled_features IS NOT NULL AND 
       v_limits.disabled_features ? _feature THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;
  
  -- Verificar se está explicitamente desabilitado (override)
  IF v_limits.disabled_features IS NOT NULL AND 
     v_limits.disabled_features ? _feature THEN
    RETURN false;
  END IF;
  
  -- Verificar se está explicitamente habilitado (override)
  IF v_limits.enabled_features IS NOT NULL AND 
     v_limits.enabled_features ? _feature THEN
    RETURN true;
  END IF;
  
  -- Herdar do plano
  v_plan_features := COALESCE(v_limits.plan_features, '[]'::jsonb);
  RETURN v_plan_features ? _feature;
END;
$$;

-- Função para inicializar organização com trial de 30 dias
CREATE OR REPLACE FUNCTION public.initialize_organization_trial(
  _organization_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO organization_limits (
    organization_id,
    trial_ends_at,
    enabled_features,
    disabled_features,
    features_override_mode
  ) VALUES (
    _organization_id,
    now() + interval '30 days',
    '[]'::jsonb,
    '[]'::jsonb,
    'inherit'
  )
  ON CONFLICT (organization_id) 
  DO UPDATE SET
    trial_ends_at = COALESCE(organization_limits.trial_ends_at, now() + interval '30 days'),
    updated_at = now();
END;
$$;

-- Trigger para inicializar trial quando organização é criada
CREATE OR REPLACE FUNCTION public.handle_new_organization_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.initialize_organization_trial(NEW.id);
  RETURN NEW;
END;
$$;

-- Remover trigger se existir e recriar
DROP TRIGGER IF EXISTS on_organization_created_init_trial ON public.organizations;

CREATE TRIGGER on_organization_created_init_trial
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization_trial();
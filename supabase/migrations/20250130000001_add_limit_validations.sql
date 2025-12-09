-- ============================================
-- MIGRAÇÃO: Adicionar Validações de Limites
-- ============================================
-- Atualizar funções existentes para verificar limites antes de criar leads e instâncias

-- Atualizar create_lead_secure para verificar limites
CREATE OR REPLACE FUNCTION public.create_lead_secure(
  p_org_id uuid,
  p_name text,
  p_phone text,
  p_email text DEFAULT NULL,
  p_company text DEFAULT NULL,
  p_value numeric DEFAULT NULL,
  p_stage_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_source text DEFAULT 'manual'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user uuid;
  v_assigned_to text;
  v_stage_exists boolean;
  v_lead_id uuid;
  v_norm_phone text;
  v_existing_lead_id uuid;
  v_existing_excluded boolean;
  v_can_create boolean;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.user_belongs_to_org(v_user, p_org_id) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização informada';
  END IF;

  -- Verificar se pode criar lead (validação de limites)
  SELECT public.can_create_lead(p_org_id) INTO v_can_create;
  IF NOT v_can_create THEN
    RAISE EXCEPTION 'Limite de leads excedido para esta organização. Entre em contato com o administrador.';
  END IF;

  -- Normalizar telefone
  v_norm_phone := regexp_replace(p_phone, '\D', '', 'g');

  -- Verificar se já existe lead com este telefone na organização
  SELECT id, excluded_from_funnel INTO v_existing_lead_id, v_existing_excluded
  FROM public.leads
  WHERE organization_id = p_org_id
    AND phone = v_norm_phone
    AND deleted_at IS NULL
  LIMIT 1;

  -- Se existe e está excluído do funil, não criar novamente
  IF v_existing_lead_id IS NOT NULL AND v_existing_excluded = true THEN
    -- Retornar o ID existente sem criar novo lead
    RETURN v_existing_lead_id;
  END IF;

  -- Se existe e não está excluído, retornar erro de duplicata
  IF v_existing_lead_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead com este telefone já existe na organização';
  END IF;

  -- Validar etapa se fornecida
  IF p_stage_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.pipeline_stages 
      WHERE id = p_stage_id AND organization_id = p_org_id
    ) INTO v_stage_exists;
    IF NOT v_stage_exists THEN
      RAISE EXCEPTION 'Etapa inválida para a organização';
    END IF;
  END IF;

  SELECT email INTO v_assigned_to FROM public.profiles WHERE id = v_user;

  INSERT INTO public.leads (
    id, user_id, organization_id, name, phone, email, company, value,
    stage_id, notes, source, assigned_to, status, excluded_from_funnel
  ) VALUES (
    gen_random_uuid(), v_user, p_org_id, p_name, v_norm_phone, p_email, p_company, p_value,
    p_stage_id, p_notes, p_source, COALESCE(v_assigned_to, ''), 'novo', false
  )
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$func$;

-- Trigger para validar antes de inserir instância Evolution
CREATE OR REPLACE FUNCTION public.validate_evolution_instance_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_create boolean;
  v_has_feature boolean;
BEGIN
  -- Verificar se a funcionalidade está habilitada
  SELECT public.has_organization_feature(NEW.organization_id, 'evolution_instances'::public.organization_feature)
  INTO v_has_feature;
  
  IF NOT v_has_feature THEN
    RAISE EXCEPTION 'Funcionalidade de instâncias Evolution não está habilitada para esta organização. Entre em contato com o administrador.';
  END IF;

  -- Verificar se pode criar instância (validação de limites)
  SELECT public.can_create_evolution_instance(NEW.organization_id) INTO v_can_create;
  
  IF NOT v_can_create THEN
    RAISE EXCEPTION 'Limite de instâncias Evolution excedido para esta organização. Entre em contato com o administrador.';
  END IF;

  RETURN NEW;
END;
$$;

-- Criar trigger antes de inserir
DROP TRIGGER IF EXISTS trg_validate_evolution_instance_limit ON public.evolution_config;
CREATE TRIGGER trg_validate_evolution_instance_limit
BEFORE INSERT ON public.evolution_config
FOR EACH ROW
EXECUTE FUNCTION public.validate_evolution_instance_limit();

-- Comentários
COMMENT ON FUNCTION public.create_lead_secure IS 'Cria um lead de forma segura, validando limites e permissões';
COMMENT ON FUNCTION public.validate_evolution_instance_limit IS 'Valida limites antes de permitir criação de instância Evolution';


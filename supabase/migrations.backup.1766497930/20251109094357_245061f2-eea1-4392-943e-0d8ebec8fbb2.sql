-- Recriar função add_to_call_queue_secure com validação corrigida
DROP FUNCTION IF EXISTS public.add_to_call_queue_secure(uuid, timestamptz, text, text);

CREATE OR REPLACE FUNCTION public.add_to_call_queue_secure(
  p_lead_id uuid,
  p_scheduled_for timestamptz,
  p_priority text,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_org_id uuid;
  v_lead_org_id uuid;
  v_existing_id uuid;
  v_new_id uuid;
BEGIN
  -- Verificar autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Obter organização do usuário
  SELECT organization_id INTO v_user_org_id
  FROM organization_members
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_user_org_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence a nenhuma organização';
  END IF;

  -- Obter organização do lead
  SELECT organization_id INTO v_lead_org_id
  FROM leads
  WHERE id = p_lead_id AND deleted_at IS NULL;

  IF v_lead_org_id IS NULL THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  -- Verificar se AMBOS pertencem à MESMA organização
  IF v_lead_org_id != v_user_org_id THEN
    RAISE EXCEPTION 'Lead pertence a organização diferente (lead: %, usuário: %)', v_lead_org_id, v_user_org_id;
  END IF;

  -- Verificar se já existe item pendente ou reagendado para este lead nesta organização
  SELECT id INTO v_existing_id
  FROM call_queue
  WHERE lead_id = p_lead_id
    AND organization_id = v_lead_org_id
    AND status IN ('pending', 'rescheduled')
  LIMIT 1;

  -- Se já existe pendente/reagendado, retornar erro
  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead já está na fila com status ativo';
  END IF;

  -- Criar novo item na fila
  INSERT INTO call_queue (
    lead_id,
    organization_id,
    scheduled_for,
    priority,
    notes,
    status,
    created_by,
    updated_by
  ) VALUES (
    p_lead_id,
    v_lead_org_id,
    p_scheduled_for,
    p_priority,
    p_notes,
    'pending',
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.add_to_call_queue_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_to_call_queue_secure TO anon;
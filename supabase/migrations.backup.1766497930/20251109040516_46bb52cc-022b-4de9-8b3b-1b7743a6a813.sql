-- Criar função segura para adicionar lead à fila de ligações
CREATE OR REPLACE FUNCTION public.add_to_call_queue_secure(
  p_lead_id uuid,
  p_scheduled_for timestamp with time zone DEFAULT now(),
  p_priority text DEFAULT 'medium',
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_org_id uuid;
  v_existing_id uuid;
  v_queue_id uuid;
BEGIN
  -- Verificar autenticação
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Obter organização do lead
  SELECT organization_id INTO v_org_id
  FROM public.leads
  WHERE id = p_lead_id AND deleted_at IS NULL;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Lead não encontrado ou foi deletado';
  END IF;

  -- Verificar se usuário pertence à organização
  IF NOT public.user_belongs_to_org(v_user, v_org_id) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização do lead';
  END IF;

  -- Verificar duplicado: já existe pendente ou reagendada para este lead na mesma org?
  SELECT id INTO v_existing_id
  FROM public.call_queue
  WHERE lead_id = p_lead_id
    AND organization_id = v_org_id
    AND status IN ('pending', 'rescheduled')
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Retornar o ID do existente para indicar que já estava na fila
    RETURN v_existing_id;
  END IF;

  -- Inserir na fila
  INSERT INTO public.call_queue (
    lead_id,
    organization_id,
    scheduled_for,
    priority,
    notes,
    status,
    created_by
  ) VALUES (
    p_lead_id,
    v_org_id,
    p_scheduled_for,
    p_priority,
    p_notes,
    'pending',
    v_user
  )
  RETURNING id INTO v_queue_id;

  RETURN v_queue_id;
END;
$$;
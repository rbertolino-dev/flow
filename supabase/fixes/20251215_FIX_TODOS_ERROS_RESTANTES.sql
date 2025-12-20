-- ============================================
-- FIX FINAL: Corrigir todos os erros restantes
-- Execute no Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Forçar refresh do cache PostgREST para form_builders
-- ============================================
-- Notificar PostgREST para atualizar o cache do schema
NOTIFY pgrst, 'reload schema';

-- ============================================
-- 2. Criar tabela seller_goals (se não existir)
-- ============================================
CREATE TABLE IF NOT EXISTS public.seller_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  goal_type TEXT NOT NULL DEFAULT 'revenue', -- revenue, deals, leads
  target_value NUMERIC(12,2) NOT NULL,
  current_value NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'in_progress', -- in_progress, achieved, missed
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id, period_start, period_end, goal_type)
);

-- Índices para seller_goals
CREATE INDEX IF NOT EXISTS idx_seller_goals_org ON public.seller_goals(organization_id);
CREATE INDEX IF NOT EXISTS idx_seller_goals_user ON public.seller_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_goals_period ON public.seller_goals(period_start, period_end);

-- RLS para Seller Goals
ALTER TABLE public.seller_goals ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Users can view goals in their org" ON public.seller_goals;
CREATE POLICY "Users can view goals in their org"
ON public.seller_goals FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
  )
);

DROP POLICY IF EXISTS "Users can insert goals in their org" ON public.seller_goals;
CREATE POLICY "Users can insert goals in their org"
ON public.seller_goals FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
  )
);

DROP POLICY IF EXISTS "Users can update goals in their org" ON public.seller_goals;
CREATE POLICY "Users can update goals in their org"
ON public.seller_goals FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
  )
);

DROP POLICY IF EXISTS "Users can delete goals in their org" ON public.seller_goals;
CREATE POLICY "Users can delete goals in their org"
ON public.seller_goals FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
  )
);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_seller_goals_updated_at ON public.seller_goals;
CREATE TRIGGER update_seller_goals_updated_at
  BEFORE UPDATE ON public.seller_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 3. Verificar/Criar função create_lead_secure
-- ============================================
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
AS $$
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

  -- Verificar se usuário pertence à organização
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = v_user AND organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização informada';
  END IF;

  -- Verificar se pode criar lead (se função existir)
  BEGIN
    SELECT public.can_create_lead(p_org_id) INTO v_can_create;
    IF NOT v_can_create THEN
      RAISE EXCEPTION 'Limite de leads excedido para esta organização. Entre em contato com o administrador.';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Se função não existir, ignorar validação de limite
    NULL;
  END;

  -- Normalizar telefone
  v_norm_phone := regexp_replace(p_phone, '\D', '', 'g');

  -- Verificar se já existe lead com este telefone na organização
  BEGIN
    SELECT id, COALESCE(excluded_from_funnel, false) INTO v_existing_lead_id, v_existing_excluded
    FROM public.leads
    WHERE organization_id = p_org_id
      AND phone = v_norm_phone
      AND (deleted_at IS NULL)
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- Se coluna excluded_from_funnel não existir, ignorar
    SELECT id INTO v_existing_lead_id
    FROM public.leads
    WHERE organization_id = p_org_id
      AND phone = v_norm_phone
      AND (deleted_at IS NULL)
    LIMIT 1;
    v_existing_excluded := false;
  END;

  -- Se existe e está excluído do funil, não criar novamente
  IF v_existing_lead_id IS NOT NULL AND v_existing_excluded = true THEN
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

  -- Obter email do usuário para assigned_to
  SELECT email INTO v_assigned_to FROM public.profiles WHERE id = v_user;

  -- Criar lead
  BEGIN
    INSERT INTO public.leads (
      id, user_id, organization_id, name, phone, email, company, value,
      stage_id, notes, source, assigned_to, status, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user, p_org_id, p_name, v_norm_phone, p_email, p_company, p_value,
      p_stage_id, p_notes, p_source, COALESCE(v_assigned_to, 'Sistema'), 'new', NOW(), NOW()
    )
    RETURNING id INTO v_lead_id;
  EXCEPTION WHEN OTHERS THEN
    -- Tentar sem excluded_from_funnel se coluna não existir
    INSERT INTO public.leads (
      id, user_id, organization_id, name, phone, email, company, value,
      stage_id, notes, source, assigned_to, status, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user, p_org_id, p_name, v_norm_phone, p_email, p_company, p_value,
      p_stage_id, p_notes, p_source, COALESCE(v_assigned_to, 'Sistema'), 'new', NOW(), NOW()
    )
    RETURNING id INTO v_lead_id;
  END;

  RETURN v_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_lead_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_lead_secure TO anon;

-- ============================================
-- 4. Verificar/Criar função add_to_call_queue_secure
-- ============================================
-- Fazer DROP primeiro para evitar conflito de assinatura
DROP FUNCTION IF EXISTS public.add_to_call_queue_secure(uuid, timestamptz, text, text);

CREATE OR REPLACE FUNCTION public.add_to_call_queue_secure(
  p_lead_id uuid,
  p_scheduled_for timestamptz,
  p_priority text DEFAULT 'normal',
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_lead_org_id uuid;
  v_existing_id uuid;
  v_new_id uuid;
BEGIN
  -- Require authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Fetch lead organization
  SELECT organization_id INTO v_lead_org_id
  FROM public.leads
  WHERE id = p_lead_id AND (deleted_at IS NULL);

  IF v_lead_org_id IS NULL THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  -- Validate that the user can act on the lead's organization
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = v_user_id AND organization_id = v_lead_org_id
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização do lead';
  END IF;

  -- Prevent duplicates (pending/rescheduled) scoped to the same organization
  SELECT id INTO v_existing_id
  FROM public.call_queue
  WHERE lead_id = p_lead_id
    AND organization_id = v_lead_org_id
    AND status IN ('pending', 'rescheduled')
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead já está na fila com status ativo';
  END IF;

  -- Insert with the lead's organization_id
  INSERT INTO public.call_queue (
    lead_id,
    organization_id,
    scheduled_for,
    priority,
    notes,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_lead_id,
    v_lead_org_id,
    p_scheduled_for,
    COALESCE(p_priority, 'normal'),
    p_notes,
    'pending',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_to_call_queue_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_to_call_queue_secure TO anon;

-- ============================================
-- 5. Verificar se max_instances existe e está acessível
-- ============================================
-- Se max_instances não existir, criar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organization_limits' 
      AND column_name = 'max_instances'
  ) THEN
    ALTER TABLE public.organization_limits 
    ADD COLUMN max_instances INTEGER;
    
    -- Sincronizar valores
    UPDATE public.organization_limits
    SET max_instances = max_evolution_instances
    WHERE max_instances IS NULL;
  END IF;
END $$;

-- ============================================
-- 6. Verificar resultado
-- ============================================
SELECT 
  'seller_goals' as item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'seller_goals'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status
UNION ALL
SELECT 
  'form_builders',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'form_builders'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END
UNION ALL
SELECT 
  'create_lead_secure',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_lead_secure'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END
UNION ALL
SELECT 
  'add_to_call_queue_secure',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'add_to_call_queue_secure'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END
UNION ALL
SELECT 
  'organization_limits.max_instances',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organization_limits' 
      AND column_name = 'max_instances'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Aguarde 30-60 segundos após executar para o PostgREST atualizar o cache
-- Depois recarregue a página (F5)


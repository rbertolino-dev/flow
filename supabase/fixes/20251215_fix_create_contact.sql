-- ============================================
-- FIX: Corrigir criação de contato (tela branca)
-- Execute no Supabase SQL Editor
-- ============================================

-- ============================================
-- 0. Garantir que products tem is_active
-- ============================================
DO $$
BEGIN
  -- Se existe active mas não is_active, criar is_active como coluna que espelha active
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'is_active'
  ) THEN
    -- Adicionar is_active como coluna que espelha active
    ALTER TABLE public.products 
    ADD COLUMN is_active BOOLEAN GENERATED ALWAYS AS (active) STORED;
    
    CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
  END IF;
  
  -- Se não existe nenhuma das duas, criar active
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name IN ('active', 'is_active')
  ) THEN
    ALTER TABLE public.products 
    ADD COLUMN active BOOLEAN DEFAULT true,
    ADD COLUMN is_active BOOLEAN GENERATED ALWAYS AS (active) STORED;
    
    CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(active);
    CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
  END IF;
END $$;

-- ============================================
-- 1. Criar tabela lead_products se não existir
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'lead_products'
  ) THEN
    CREATE TABLE public.lead_products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
      quantity INTEGER DEFAULT 1,
      unit_price NUMERIC(12,2) NOT NULL,
      discount NUMERIC(12,2) DEFAULT 0,
      total_price NUMERIC(12,2) NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(lead_id, product_id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_products_lead ON public.lead_products(lead_id);
    CREATE INDEX IF NOT EXISTS idx_lead_products_product ON public.lead_products(product_id);

    ALTER TABLE public.lead_products ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "lead_products_select_org_members"
    ON public.lead_products FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.leads l
        JOIN public.organization_members om ON om.organization_id = l.organization_id
        WHERE l.id = lead_products.lead_id
          AND om.user_id = auth.uid()
      )
    );

    CREATE POLICY "lead_products_insert_org_members"
    ON public.lead_products FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.leads l
        JOIN public.organization_members om ON om.organization_id = l.organization_id
        WHERE l.id = lead_products.lead_id
          AND om.user_id = auth.uid()
      )
    );

    CREATE POLICY "lead_products_update_org_members"
    ON public.lead_products FOR UPDATE
    USING (
      EXISTS (
        SELECT 1
        FROM public.leads l
        JOIN public.organization_members om ON om.organization_id = l.organization_id
        WHERE l.id = lead_products.lead_id
          AND om.user_id = auth.uid()
      )
    );

    CREATE POLICY "lead_products_delete_org_members"
    ON public.lead_products FOR DELETE
    USING (
      EXISTS (
        SELECT 1
        FROM public.leads l
        JOIN public.organization_members om ON om.organization_id = l.organization_id
        WHERE l.id = lead_products.lead_id
          AND om.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- ============================================
-- 2. Garantir que função create_lead_secure existe
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

  IF NOT public.user_belongs_to_org(v_user, p_org_id) THEN
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
  SELECT id, COALESCE(excluded_from_funnel, false) INTO v_existing_lead_id, v_existing_excluded
  FROM public.leads
  WHERE organization_id = p_org_id
    AND phone = v_norm_phone
    AND (deleted_at IS NULL OR deleted_at > NOW())
  LIMIT 1;

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
  INSERT INTO public.leads (
    id, user_id, organization_id, name, phone, email, company, value,
    stage_id, notes, source, assigned_to, status, excluded_from_funnel, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user, p_org_id, p_name, v_norm_phone, p_email, p_company, p_value,
    p_stage_id, p_notes, p_source, COALESCE(v_assigned_to, 'Sistema'), 'new', false, NOW(), NOW()
  )
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$$;

-- ============================================
-- 3. Garantir que função add_to_call_queue_secure existe
-- ============================================
CREATE OR REPLACE FUNCTION public.add_to_call_queue_secure(
  p_lead_id uuid,
  p_scheduled_for timestamptz,
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
  v_queue_id uuid;
  v_existing_id uuid;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Obter organization_id do lead
  SELECT organization_id INTO v_org_id
  FROM public.leads
  WHERE id = p_lead_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  IF NOT public.user_belongs_to_org(v_user, v_org_id) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização do lead';
  END IF;

  -- Verificar se já existe na fila
  SELECT id INTO v_existing_id
  FROM public.call_queue
  WHERE lead_id = p_lead_id
    AND status IN ('pending', 'scheduled')
    AND (deleted_at IS NULL OR deleted_at > NOW())
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este lead já está na fila de ligações';
  END IF;

  -- Criar entrada na fila
  INSERT INTO public.call_queue (
    id, lead_id, organization_id, scheduled_for, priority, notes, status, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), p_lead_id, v_org_id, p_scheduled_for, p_priority, p_notes, 'pending', NOW(), NOW()
  )
  RETURNING id INTO v_queue_id;

  RETURN v_queue_id;
END;
$$;

-- ============================================
-- 4. Garantir que função user_belongs_to_org existe
-- ============================================
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
  );
$$;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Após executar, tente criar um contato novamente


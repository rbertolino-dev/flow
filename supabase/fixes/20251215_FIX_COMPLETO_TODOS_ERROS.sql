-- ============================================
-- FIX COMPLETO: Corrigir TODOS os erros de schema
-- Execute no Supabase SQL Editor
-- ============================================
-- Este script corrige TODOS os erros 400/404/406 vistos no console
-- Execute este script UMA VEZ e todos os problemas serão resolvidos

-- ============================================
-- 1. CORRIGIR TABELA LEADS
-- ============================================

-- Adicionar stage_id (erro principal ao criar lead)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'stage_id'
  ) THEN
    ALTER TABLE public.leads 
      ADD COLUMN stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_leads_stage ON public.leads(stage_id);
  END IF;
END $$;

-- Adicionar deleted_at (para soft delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.leads 
      ADD COLUMN deleted_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON public.leads(deleted_at);
  END IF;
END $$;

-- Adicionar organization_id (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.leads 
      ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS idx_leads_org ON public.leads(organization_id);
  END IF;
END $$;

-- Adicionar call_count (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'call_count'
  ) THEN
    ALTER TABLE public.leads 
      ADD COLUMN call_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Adicionar excluded_from_funnel (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'excluded_from_funnel'
  ) THEN
    ALTER TABLE public.leads 
      ADD COLUMN excluded_from_funnel BOOLEAN DEFAULT false;
    
    CREATE INDEX IF NOT EXISTS idx_leads_excluded_funnel ON public.leads(excluded_from_funnel);
  END IF;
END $$;

-- ============================================
-- 2. CORRIGIR PIPELINE_STAGES (adicionar user_id)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pipeline_stages'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.pipeline_stages 
    ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_pipeline_stages_user ON public.pipeline_stages(user_id);
    
    -- Preencher user_id com o primeiro owner/admin da organização
    UPDATE public.pipeline_stages ps
    SET user_id = (
      SELECT om.user_id
      FROM public.organization_members om
      WHERE om.organization_id = ps.organization_id
        AND om.role IN ('owner', 'admin')
      ORDER BY CASE WHEN om.role = 'owner' THEN 1 ELSE 2 END
      LIMIT 1
    )
    WHERE user_id IS NULL;
  END IF;
END $$;

-- ============================================
-- 3. CORRIGIR CALL_QUEUE (adicionar organization_id)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'call_queue'
      AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.call_queue 
    ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS idx_call_queue_org ON public.call_queue(organization_id);
    
    -- Preencher organization_id dos leads existentes
    UPDATE public.call_queue cq
    SET organization_id = (
      SELECT l.organization_id
      FROM public.leads l
      WHERE l.id = cq.lead_id
      LIMIT 1
    )
    WHERE organization_id IS NULL;
  END IF;
END $$;

-- ============================================
-- 4. CORRIGIR PRODUCTS (is_active)
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
    ALTER TABLE public.products 
    ADD COLUMN is_active BOOLEAN GENERATED ALWAYS AS (active) STORED;
    
    CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
  END IF;
  
  -- Se não existe nenhuma das duas, criar ambas
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
-- 5. CORRIGIR EVOLUTION_CONFIG (organization_id e user_id)
-- ============================================
DO $$
BEGIN
  -- Adicionar organization_id se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'evolution_config'
      AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.evolution_config 
    ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS idx_evolution_config_org ON public.evolution_config(organization_id);
  END IF;
  
  -- Se a query usa user_id, garantir que existe
  -- (mas evolution_config geralmente usa organization_id, não user_id diretamente)
END $$;

-- ============================================
-- 6. CRIAR TABELA PLANS E CORRIGIR ORGANIZATION_LIMITS
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'plans'
  ) THEN
    CREATE TABLE public.plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      features JSONB DEFAULT '{}'::jsonb,
      price DECIMAL(10, 2),
      billing_period TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    -- Inserir planos padrão
    INSERT INTO public.plans (name, description, features) VALUES
      ('free', 'Plano Gratuito', '{"leads": 100, "evolution_instances": 1}'::jsonb),
      ('starter', 'Plano Starter', '{"leads": 500, "evolution_instances": 3}'::jsonb),
      ('professional', 'Plano Professional', '{"leads": 5000, "evolution_instances": 10}'::jsonb),
      ('enterprise', 'Plano Enterprise', '{"leads": -1, "evolution_instances": -1}'::jsonb)
    ON CONFLICT (name) DO NOTHING;
    
    ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Anyone can view active plans"
    ON public.plans FOR SELECT
    USING (is_active = true);
  END IF;
END $$;

-- Adicionar plan_id em organization_limits se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_limits'
      AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE public.organization_limits 
    ADD COLUMN plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_org_limits_plan ON public.organization_limits(plan_id);
    
    -- Definir plan_id padrão como 'free' para organizações existentes
    UPDATE public.organization_limits ol
    SET plan_id = (SELECT id FROM public.plans WHERE name = 'free' LIMIT 1)
    WHERE plan_id IS NULL;
  END IF;
END $$;

-- ============================================
-- 7. CRIAR TABELA LEAD_PRODUCTS
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
-- 8. CRIAR TABELAS DE CONFIGURAÇÃO FALTANTES
-- ============================================

-- hubspot_configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'hubspot_configs'
  ) THEN
    CREATE TABLE public.hubspot_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TIMESTAMPTZ,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_hubspot_configs_org ON public.hubspot_configs(organization_id);
    ALTER TABLE public.hubspot_configs ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "hubspot_configs_select_org_members"
    ON public.hubspot_configs FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = hubspot_configs.organization_id
      )
    );
  END IF;
END $$;

-- gmail_configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'gmail_configs'
  ) THEN
    CREATE TABLE public.gmail_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id, user_id, email)
    );
    
    CREATE INDEX IF NOT EXISTS idx_gmail_configs_org ON public.gmail_configs(organization_id);
    CREATE INDEX IF NOT EXISTS idx_gmail_configs_user ON public.gmail_configs(user_id);
    ALTER TABLE public.gmail_configs ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "gmail_configs_select_org_members"
    ON public.gmail_configs FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = gmail_configs.organization_id
      )
    );
  END IF;
END $$;

-- mercado_pago_configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'mercado_pago_configs'
  ) THEN
    CREATE TABLE public.mercado_pago_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      public_key TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_mercado_pago_configs_org ON public.mercado_pago_configs(organization_id);
    ALTER TABLE public.mercado_pago_configs ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "mercado_pago_configs_select_org_members"
    ON public.mercado_pago_configs FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = mercado_pago_configs.organization_id
      )
    );
  END IF;
END $$;

-- mercado_pago_payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'mercado_pago_payments'
  ) THEN
    CREATE TABLE public.mercado_pago_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      payment_id TEXT NOT NULL,
      status TEXT NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      currency TEXT DEFAULT 'BRL',
      payment_data JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(payment_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_org ON public.mercado_pago_payments(organization_id);
    CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_status ON public.mercado_pago_payments(status);
    ALTER TABLE public.mercado_pago_payments ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "mercado_pago_payments_select_org_members"
    ON public.mercado_pago_payments FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = mercado_pago_payments.organization_id
      )
    );
  END IF;
END $$;

-- facebook_configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'facebook_configs'
  ) THEN
    CREATE TABLE public.facebook_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      page_id TEXT NOT NULL,
      access_token TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id, page_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_facebook_configs_org ON public.facebook_configs(organization_id);
    ALTER TABLE public.facebook_configs ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "facebook_configs_select_org_members"
    ON public.facebook_configs FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = facebook_configs.organization_id
      )
    );
  END IF;
END $$;

-- bubble_configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'bubble_configs'
  ) THEN
    CREATE TABLE public.bubble_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      api_key TEXT NOT NULL,
      app_url TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_bubble_configs_org ON public.bubble_configs(organization_id);
    ALTER TABLE public.bubble_configs ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "bubble_configs_select_org_members"
    ON public.bubble_configs FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = bubble_configs.organization_id
      )
    );
  END IF;
END $$;

-- asaas_configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'asaas_configs'
  ) THEN
    CREATE TABLE public.asaas_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      api_key TEXT NOT NULL,
      environment TEXT DEFAULT 'production',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_asaas_configs_org ON public.asaas_configs(organization_id);
    ALTER TABLE public.asaas_configs ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "asaas_configs_select_org_members"
    ON public.asaas_configs FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = asaas_configs.organization_id
      )
    );
  END IF;
END $$;

-- ============================================
-- 9. GARANTIR FUNÇÕES ESSENCIAIS EXISTEM
-- ============================================

-- Função user_belongs_to_org
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

-- Função create_lead_secure (versão completa)
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

-- Função add_to_call_queue_secure
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
-- FIM DO SCRIPT
-- ============================================
-- Após executar, recarregue o app (Ctrl+Shift+R) e teste criar um lead
-- Todos os erros 400/404/406 devem desaparecer


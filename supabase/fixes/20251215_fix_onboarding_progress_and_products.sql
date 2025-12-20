-- ============================================
-- FIX: Criar tabelas organization_onboarding_progress e products
-- Execute no Supabase SQL Editor
-- ============================================
-- Este script cria as tabelas que estão faltando

-- ============================================
-- 1. Tabela organization_onboarding_progress
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_onboarding_progress'
  ) THEN
    CREATE TABLE public.organization_onboarding_progress (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      step_completed TEXT NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id, step_completed)
    );

    CREATE INDEX idx_onboarding_progress_org ON public.organization_onboarding_progress(organization_id);
    CREATE INDEX idx_onboarding_progress_step ON public.organization_onboarding_progress(step_completed);

    ALTER TABLE public.organization_onboarding_progress ENABLE ROW LEVEL SECURITY;

    -- Policies RLS
    CREATE POLICY "Users can view onboarding progress of their organization"
    ON public.organization_onboarding_progress FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = organization_onboarding_progress.organization_id
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    );

    CREATE POLICY "Users can insert onboarding progress for their organization"
    ON public.organization_onboarding_progress FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = organization_onboarding_progress.organization_id
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    );

    CREATE POLICY "Users can update onboarding progress of their organization"
    ON public.organization_onboarding_progress FOR UPDATE
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = organization_onboarding_progress.organization_id
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = organization_onboarding_progress.organization_id
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    );
  END IF;
END $$;

-- ============================================
-- 2. Tabela products
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'products'
  ) THEN
    CREATE TABLE public.products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      sku TEXT,
      price NUMERIC(12,2) NOT NULL DEFAULT 0,
      cost NUMERIC(12,2) DEFAULT 0,
      category TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      stock_quantity INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 0,
      unit TEXT DEFAULT 'un',
      image_url TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      created_by UUID REFERENCES public.profiles(id),
      UNIQUE(organization_id, sku)
    );

    CREATE INDEX idx_products_organization ON public.products(organization_id);
    CREATE INDEX idx_products_category ON public.products(organization_id, category);
    CREATE INDEX idx_products_active ON public.products(organization_id, is_active) WHERE is_active = true;

    ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

    -- Policies RLS
    CREATE POLICY "Users can view products of their organization"
    ON public.products FOR SELECT
    USING (
      organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    );

    CREATE POLICY "Users can create products for their organization"
    ON public.products FOR INSERT
    WITH CHECK (
      organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    );

    CREATE POLICY "Users can update products of their organization"
    ON public.products FOR UPDATE
    USING (
      organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    )
    WITH CHECK (
      organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    );

    CREATE POLICY "Users can delete products of their organization"
    ON public.products FOR DELETE
    USING (
      organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    );

    -- Trigger para updated_at
    CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 3. Verificar resultado
-- ============================================
SELECT 
  'organization_onboarding_progress' as tabela,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_onboarding_progress'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status
UNION ALL
SELECT 
  'products',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'products'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END;


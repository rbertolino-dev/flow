-- ============================================
-- FIX: Products Commission + Post Sale Tables
-- Execute no Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Adicionar colunas de comissão em products
-- ============================================
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5, 2) DEFAULT 0 CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  ADD COLUMN IF NOT EXISTS commission_fixed DECIMAL(10, 2) DEFAULT 0 CHECK (commission_fixed >= 0);

-- Atualizar valores NULL para 0
UPDATE public.products
SET commission_percentage = COALESCE(commission_percentage, 0),
    commission_fixed = COALESCE(commission_fixed, 0)
WHERE commission_percentage IS NULL OR commission_fixed IS NULL;

COMMENT ON COLUMN public.products.commission_percentage IS 'Percentual de comissão sobre o valor do produto (0-100)';
COMMENT ON COLUMN public.products.commission_fixed IS 'Valor fixo de comissão por venda do produto';

-- ============================================
-- 2. Criar tabelas de pós-venda
-- ============================================

-- Tabela: post_sale_stages (Etapas do Funil de Pós-Venda)
CREATE TABLE IF NOT EXISTS public.post_sale_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Tabela: post_sale_leads (Leads/Clientes do Pós-Venda)
CREATE TABLE IF NOT EXISTS public.post_sale_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.post_sale_stages(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  company TEXT,
  value NUMERIC,
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT NOT NULL DEFAULT 'manual',
  assigned_to TEXT,
  notes TEXT,
  last_contact TIMESTAMPTZ DEFAULT now(),
  original_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  transferred_at TIMESTAMPTZ,
  transferred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Tabela: post_sale_activities (Atividades dos Leads de Pós-Venda)
CREATE TABLE IF NOT EXISTS public.post_sale_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_sale_lead_id UUID NOT NULL REFERENCES public.post_sale_leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'whatsapp', 'call', 'note', 'status_change'
  content TEXT NOT NULL,
  direction TEXT, -- 'incoming', 'outgoing'
  user_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: post_sale_lead_tags (Tags dos Leads de Pós-Venda)
CREATE TABLE IF NOT EXISTS public.post_sale_lead_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_sale_lead_id UUID NOT NULL REFERENCES public.post_sale_leads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_sale_lead_id, tag_id)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_post_sale_stages_org ON public.post_sale_stages(organization_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_org ON public.post_sale_leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_stage ON public.post_sale_leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_phone ON public.post_sale_leads(phone);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_deleted ON public.post_sale_leads(deleted_at);
CREATE INDEX IF NOT EXISTS idx_post_sale_activities_lead ON public.post_sale_activities(post_sale_lead_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_lead_tags_lead ON public.post_sale_lead_tags(post_sale_lead_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_lead_tags_tag ON public.post_sale_lead_tags(tag_id);

-- ============================================
-- 3. RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE public.post_sale_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_sale_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_sale_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_sale_lead_tags ENABLE ROW LEVEL SECURITY;

-- Policies para post_sale_stages
DROP POLICY IF EXISTS "Users can view stages from their org" ON public.post_sale_stages;
CREATE POLICY "Users can view stages from their org"
  ON public.post_sale_stages FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert stages in their org" ON public.post_sale_stages;
CREATE POLICY "Users can insert stages in their org"
  ON public.post_sale_stages FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update stages in their org" ON public.post_sale_stages;
CREATE POLICY "Users can update stages in their org"
  ON public.post_sale_stages FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete stages in their org" ON public.post_sale_stages;
CREATE POLICY "Users can delete stages in their org"
  ON public.post_sale_stages FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- Policies para post_sale_leads
DROP POLICY IF EXISTS "Users can view leads from their org" ON public.post_sale_leads;
CREATE POLICY "Users can view leads from their org"
  ON public.post_sale_leads FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert leads in their org" ON public.post_sale_leads;
CREATE POLICY "Users can insert leads in their org"
  ON public.post_sale_leads FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update leads in their org" ON public.post_sale_leads;
CREATE POLICY "Users can update leads in their org"
  ON public.post_sale_leads FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete leads in their org" ON public.post_sale_leads;
CREATE POLICY "Users can delete leads in their org"
  ON public.post_sale_leads FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- Policies para post_sale_activities
DROP POLICY IF EXISTS "Users can view activities from their org" ON public.post_sale_activities;
CREATE POLICY "Users can view activities from their org"
  ON public.post_sale_activities FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert activities in their org" ON public.post_sale_activities;
CREATE POLICY "Users can insert activities in their org"
  ON public.post_sale_activities FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- Policies para post_sale_lead_tags
DROP POLICY IF EXISTS "Users can view tags from their org leads" ON public.post_sale_lead_tags;
CREATE POLICY "Users can view tags from their org leads"
  ON public.post_sale_lead_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.post_sale_leads psl
      WHERE psl.id = post_sale_lead_tags.post_sale_lead_id
        AND psl.organization_id IN (
          SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Users can add tags to their org leads" ON public.post_sale_lead_tags;
CREATE POLICY "Users can add tags to their org leads"
  ON public.post_sale_lead_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.post_sale_leads psl
      WHERE psl.id = post_sale_lead_tags.post_sale_lead_id
        AND psl.organization_id IN (
          SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Users can remove tags from their org leads" ON public.post_sale_lead_tags;
CREATE POLICY "Users can remove tags from their org leads"
  ON public.post_sale_lead_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.post_sale_leads psl
      WHERE psl.id = post_sale_lead_tags.post_sale_lead_id
        AND psl.organization_id IN (
          SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    )
  );

-- ============================================
-- 4. FUNÇÃO: Criar etapas padrão de pós-venda
-- ============================================
CREATE OR REPLACE FUNCTION public.create_default_post_sale_stages(
  p_org_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inserir etapas padrão apenas se não existirem
  INSERT INTO public.post_sale_stages (organization_id, user_id, name, color, position)
  VALUES
    (p_org_id, p_user_id, 'Novo Cliente', '#10b981', 0),
    (p_org_id, p_user_id, 'Ativação', '#3b82f6', 1),
    (p_org_id, p_user_id, 'Suporte', '#f59e0b', 2),
    (p_org_id, p_user_id, 'Renovação', '#8b5cf6', 3),
    (p_org_id, p_user_id, 'Fidelizado', '#22c55e', 4)
  ON CONFLICT (organization_id, name) DO NOTHING;
END;
$$;

-- ============================================
-- 5. TRIGGER: Atualizar updated_at automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION public.update_post_sale_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_post_sale_stages_updated_at ON public.post_sale_stages;
CREATE TRIGGER update_post_sale_stages_updated_at
  BEFORE UPDATE ON public.post_sale_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_post_sale_updated_at();

DROP TRIGGER IF EXISTS update_post_sale_leads_updated_at ON public.post_sale_leads;
CREATE TRIGGER update_post_sale_leads_updated_at
  BEFORE UPDATE ON public.post_sale_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_post_sale_updated_at();

-- ============================================
-- 6. Forçar refresh do cache PostgREST
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- 7. Verificar resultado
-- ============================================
SELECT 
  'products.commission_percentage' as item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'products' 
      AND column_name = 'commission_percentage'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status
UNION ALL
SELECT 
  'products.commission_fixed',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'products' 
      AND column_name = 'commission_fixed'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END
UNION ALL
SELECT 
  'post_sale_stages',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'post_sale_stages'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END
UNION ALL
SELECT 
  'post_sale_leads',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'post_sale_leads'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Aguarde 30-60 segundos após executar para o PostgREST atualizar o cache
-- Depois recarregue a página (F5)

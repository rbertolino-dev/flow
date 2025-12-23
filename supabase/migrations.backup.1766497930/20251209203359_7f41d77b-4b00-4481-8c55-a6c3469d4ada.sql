-- Tabela de Produtos
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) DEFAULT 0,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  stock_quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'un',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(organization_id, sku)
);

-- Tabela de Metas de Vendedor
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_products_org ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(organization_id, category);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_seller_goals_org ON public.seller_goals(organization_id);
CREATE INDEX IF NOT EXISTS idx_seller_goals_user ON public.seller_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_goals_period ON public.seller_goals(period_start, period_end);

-- RLS para Products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view products in their org"
ON public.products FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can insert products in their org"
ON public.products FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update products in their org"
ON public.products FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can delete products in their org"
ON public.products FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- RLS para Seller Goals
ALTER TABLE public.seller_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view goals in their org"
ON public.seller_goals FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Admins can insert goals"
ON public.seller_goals FOR INSERT
WITH CHECK (
  public.user_is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update goals"
ON public.seller_goals FOR UPDATE
USING (
  public.user_is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete goals"
ON public.seller_goals FOR DELETE
USING (
  public.user_is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Triggers para updated_at
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seller_goals_updated_at
  BEFORE UPDATE ON public.seller_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
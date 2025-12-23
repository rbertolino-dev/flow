-- Tabela de Planos
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  billing_period TEXT DEFAULT 'monthly', -- monthly, yearly
  max_leads INTEGER,
  max_users INTEGER,
  max_instances INTEGER,
  max_broadcasts_per_month INTEGER,
  max_scheduled_messages_per_month INTEGER,
  max_storage_gb NUMERIC(10,2),
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Limites por Organização
CREATE TABLE IF NOT EXISTS public.organization_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  plan_id UUID REFERENCES public.plans(id),
  max_leads INTEGER,
  max_users INTEGER,
  max_instances INTEGER,
  max_broadcasts_per_month INTEGER,
  max_scheduled_messages_per_month INTEGER,
  max_storage_gb NUMERIC(10,2),
  current_leads_count INTEGER DEFAULT 0,
  current_users_count INTEGER DEFAULT 0,
  current_instances_count INTEGER DEFAULT 0,
  current_month_broadcasts INTEGER DEFAULT 0,
  current_month_scheduled INTEGER DEFAULT 0,
  current_storage_used_gb NUMERIC(10,2) DEFAULT 0,
  last_reset_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Comissões de Vendedor
CREATE TABLE IF NOT EXISTS public.seller_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  sale_value NUMERIC(12,2) NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL,
  commission_value NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, paid
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Produtos vinculados a Leads
CREATE TABLE IF NOT EXISTS public.lead_products (
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_organization_limits_org ON public.organization_limits(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_limits_plan ON public.organization_limits(plan_id);
CREATE INDEX IF NOT EXISTS idx_seller_commissions_org ON public.seller_commissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_seller_commissions_user ON public.seller_commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_commissions_status ON public.seller_commissions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_lead_products_lead ON public.lead_products(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_products_product ON public.lead_products(product_id);

-- RLS Plans (público para leitura, admin para escrita)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
ON public.plans FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Only admins can manage plans"
ON public.plans FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

-- RLS Organization Limits
ALTER TABLE public.organization_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org limits"
ON public.organization_limits FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Admins can manage org limits"
ON public.organization_limits FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

-- RLS Seller Commissions
ALTER TABLE public.seller_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view commissions in their org"
ON public.seller_commissions FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Admins can insert commissions"
ON public.seller_commissions FOR INSERT
WITH CHECK (
  user_is_org_admin(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update commissions"
ON public.seller_commissions FOR UPDATE
USING (
  user_is_org_admin(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete commissions"
ON public.seller_commissions FOR DELETE
USING (
  user_is_org_admin(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- RLS Lead Products
ALTER TABLE public.lead_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lead products in their org"
ON public.lead_products FOR SELECT
USING (
  lead_id IN (
    SELECT id FROM leads WHERE organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can insert lead products in their org"
ON public.lead_products FOR INSERT
WITH CHECK (
  lead_id IN (
    SELECT id FROM leads WHERE organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update lead products in their org"
ON public.lead_products FOR UPDATE
USING (
  lead_id IN (
    SELECT id FROM leads WHERE organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can delete lead products in their org"
ON public.lead_products FOR DELETE
USING (
  lead_id IN (
    SELECT id FROM leads WHERE organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Triggers
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organization_limits_updated_at
  BEFORE UPDATE ON public.organization_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seller_commissions_updated_at
  BEFORE UPDATE ON public.seller_commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
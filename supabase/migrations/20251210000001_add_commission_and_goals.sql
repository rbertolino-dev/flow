-- Adicionar campo de comissão na tabela products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5, 2) DEFAULT 0 CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  ADD COLUMN IF NOT EXISTS commission_fixed DECIMAL(10, 2) DEFAULT 0 CHECK (commission_fixed >= 0);

-- Criar tabela de metas para vendedores
CREATE TABLE IF NOT EXISTS public.seller_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'weekly', 'quarterly', 'yearly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_leads INTEGER DEFAULT 0,
  target_value DECIMAL(10, 2) DEFAULT 0,
  target_commission DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(organization_id, user_id, period_type, period_start)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_seller_goals_organization ON public.seller_goals(organization_id);
CREATE INDEX IF NOT EXISTS idx_seller_goals_user ON public.seller_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_goals_period ON public.seller_goals(period_type, period_start, period_end);

-- Habilitar RLS
ALTER TABLE public.seller_goals ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para seller_goals
CREATE POLICY "Users can view goals of their organization"
ON public.seller_goals FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create goals for their organization"
ON public.seller_goals FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update goals of their organization"
ON public.seller_goals FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete goals of their organization"
ON public.seller_goals FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE TRIGGER update_seller_goals_updated_at
  BEFORE UPDATE ON public.seller_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários para documentação
COMMENT ON COLUMN public.products.commission_percentage IS 'Percentual de comissão sobre o valor do produto (0-100)';
COMMENT ON COLUMN public.products.commission_fixed IS 'Valor fixo de comissão por venda do produto';
COMMENT ON TABLE public.seller_goals IS 'Metas de vendas e comissões para vendedores';
COMMENT ON COLUMN public.seller_goals.period_type IS 'Tipo de período: monthly, weekly, quarterly, yearly';
COMMENT ON COLUMN public.seller_goals.target_leads IS 'Meta de quantidade de leads ganhos';
COMMENT ON COLUMN public.seller_goals.target_value IS 'Meta de valor total em vendas';
COMMENT ON COLUMN public.seller_goals.target_commission IS 'Meta de comissão total';




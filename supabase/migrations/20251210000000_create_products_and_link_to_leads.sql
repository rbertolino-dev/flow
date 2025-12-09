-- Criar tabela de produtos/serviços
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_products_organization ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(active);

-- Habilitar RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para products
CREATE POLICY "Users can view products of their organization"
ON public.products FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create products for their organization"
ON public.products FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update products of their organization"
ON public.products FOR UPDATE
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

CREATE POLICY "Users can delete products of their organization"
ON public.products FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Adicionar coluna product_id na tabela leads
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- Criar índice para product_id
CREATE INDEX IF NOT EXISTS idx_leads_product ON public.leads(product_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE public.products IS 'Tabela de produtos/serviços que podem ser vinculados a leads';
COMMENT ON COLUMN public.products.name IS 'Nome do produto ou serviço';
COMMENT ON COLUMN public.products.price IS 'Preço do produto ou serviço';
COMMENT ON COLUMN public.products.category IS 'Categoria do produto ou serviço';
COMMENT ON COLUMN public.products.active IS 'Indica se o produto está ativo e disponível para venda';
COMMENT ON COLUMN public.leads.product_id IS 'Referência ao produto/serviço vinculado ao lead';


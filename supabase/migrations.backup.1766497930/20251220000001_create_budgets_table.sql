-- Migration: Criar tabela de orçamentos
-- Data: 2025-12-20

-- Criar tabela de orçamentos
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    budget_number TEXT NOT NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    client_data JSONB, -- Dados do cliente no momento da criação
    products JSONB DEFAULT '[]'::jsonb, -- Array de produtos
    services JSONB DEFAULT '[]'::jsonb, -- Array de serviços
    payment_methods TEXT[] DEFAULT '{}', -- Formas de pagamento
    validity_days INTEGER DEFAULT 30, -- Validade em dias
    expires_at DATE, -- Data de expiração calculada
    delivery_date DATE, -- Data de entrega
    delivery_location TEXT, -- Local de entrega
    observations TEXT, -- Observações gerais
    subtotal_products NUMERIC(12, 2) DEFAULT 0,
    subtotal_services NUMERIC(12, 2) DEFAULT 0,
    additions NUMERIC(12, 2) DEFAULT 0, -- Acréscimos/descontos
    total NUMERIC(12, 2) DEFAULT 0,
    background_image_url TEXT, -- URL da imagem de fundo
    pdf_url TEXT, -- URL do PDF gerado
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_budgets_organization ON public.budgets(organization_id);
CREATE INDEX IF NOT EXISTS idx_budgets_lead ON public.budgets(lead_id);
CREATE INDEX IF NOT EXISTS idx_budgets_number ON public.budgets(organization_id, budget_number);
CREATE INDEX IF NOT EXISTS idx_budgets_created_at ON public.budgets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budgets_expires_at ON public.budgets(expires_at);

-- Criar função para gerar número de orçamento único
CREATE OR REPLACE FUNCTION generate_budget_number(org_id UUID)
RETURNS TEXT AS $$
DECLARE
    prefix TEXT;
    year_month TEXT;
    sequence_num INTEGER;
    budget_num TEXT;
BEGIN
    -- Prefixo baseado na organização (primeiros 4 caracteres do UUID)
    prefix := UPPER(SUBSTRING(org_id::TEXT, 1, 4));
    
    -- Ano e mês atual
    year_month := TO_CHAR(now(), 'YYYYMM');
    
    -- Buscar próximo número da sequência do mês
    SELECT COALESCE(MAX(CAST(SUBSTRING(budget_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM public.budgets
    WHERE organization_id = org_id
      AND budget_number LIKE prefix || '-' || year_month || '-%';
    
    -- Formato: ORG-YYYYMM-0001
    budget_num := prefix || '-' || year_month || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN budget_num;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_budgets_updated_at ON public.budgets;
CREATE TRIGGER update_budgets_updated_at
    BEFORE UPDATE ON public.budgets
    FOR EACH ROW
    EXECUTE FUNCTION update_budgets_updated_at();

-- Habilitar RLS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (remover existentes antes de criar)
DROP POLICY IF EXISTS "Users can view budgets of their organization" ON public.budgets;
CREATE POLICY "Users can view budgets of their organization"
ON public.budgets FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
);

DROP POLICY IF EXISTS "Users can create budgets for their organization" ON public.budgets;
CREATE POLICY "Users can create budgets for their organization"
ON public.budgets FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
);

DROP POLICY IF EXISTS "Users can update budgets of their organization" ON public.budgets;
CREATE POLICY "Users can update budgets of their organization"
ON public.budgets FOR UPDATE
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

DROP POLICY IF EXISTS "Users can delete budgets of their organization" ON public.budgets;
CREATE POLICY "Users can delete budgets of their organization"
ON public.budgets FOR DELETE
USING (
    organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
);


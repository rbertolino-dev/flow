-- Migration: Criar tabela de imagens de fundo para orçamentos
-- Data: 2025-12-20

-- Criar tabela de backgrounds
CREATE TABLE IF NOT EXISTS public.budget_backgrounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_budget_backgrounds_organization ON public.budget_backgrounds(organization_id);

-- Criar trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_budget_backgrounds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_budget_backgrounds_updated_at ON public.budget_backgrounds;
CREATE TRIGGER update_budget_backgrounds_updated_at
    BEFORE UPDATE ON public.budget_backgrounds
    FOR EACH ROW
    EXECUTE FUNCTION update_budget_backgrounds_updated_at();

-- Habilitar RLS
ALTER TABLE public.budget_backgrounds ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (remover existentes antes de criar)
DROP POLICY IF EXISTS "Users can view backgrounds of their organization" ON public.budget_backgrounds;
CREATE POLICY "Users can view backgrounds of their organization"
ON public.budget_backgrounds FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
);

DROP POLICY IF EXISTS "Users can create backgrounds for their organization" ON public.budget_backgrounds;
CREATE POLICY "Users can create backgrounds for their organization"
ON public.budget_backgrounds FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
);

DROP POLICY IF EXISTS "Users can update backgrounds of their organization" ON public.budget_backgrounds;
CREATE POLICY "Users can update backgrounds of their organization"
ON public.budget_backgrounds FOR UPDATE
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

DROP POLICY IF EXISTS "Users can delete backgrounds of their organization" ON public.budget_backgrounds;
CREATE POLICY "Users can delete backgrounds of their organization"
ON public.budget_backgrounds FOR DELETE
USING (
    organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
);


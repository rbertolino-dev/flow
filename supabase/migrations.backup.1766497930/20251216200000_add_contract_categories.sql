-- ============================================
-- Migração: Sistema de Categorias/Tags para Contratos
-- ============================================

-- Tabela de categorias de contratos
CREATE TABLE IF NOT EXISTS public.contract_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  icon TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Adicionar campo category_id em contracts
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.contract_categories(id) ON DELETE SET NULL;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contract_categories_org ON public.contract_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_contract_categories_active ON public.contract_categories(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_contracts_category ON public.contracts(category_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_contract_categories_updated_at
BEFORE UPDATE ON public.contract_categories
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.contract_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies para contract_categories
CREATE POLICY "Users can view categories from their organization"
ON public.contract_categories FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create categories in their organization"
ON public.contract_categories FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update categories in their organization"
ON public.contract_categories FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can delete categories"
ON public.contract_categories FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  )
);

-- Comentários
COMMENT ON TABLE public.contract_categories IS 'Categorias para organizar contratos por tipo, cliente, projeto, etc.';
COMMENT ON COLUMN public.contract_categories.color IS 'Cor hexadecimal para exibição visual (ex: #3b82f6)';
COMMENT ON COLUMN public.contract_categories.icon IS 'Nome do ícone do lucide-react para exibição';


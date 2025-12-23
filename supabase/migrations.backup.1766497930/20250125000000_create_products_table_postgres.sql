-- Migration: Criar tabela de produtos no PostgreSQL
-- Data: 2025-01-25
-- Banco: budget_services
-- Descrição: Tabela de produtos com validação robusta de organização

-- Criar tabela de produtos
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  organization_name TEXT NOT NULL, -- Nome da empresa/organização (sincronizado com Supabase)
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
  commission_percentage NUMERIC(5,2) DEFAULT 0,
  commission_fixed NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  created_by_name TEXT, -- Nome do usuário que criou (opcional, para auditoria)
  updated_by UUID,
  updated_by_name TEXT, -- Nome do usuário que modificou (opcional, para auditoria)
  UNIQUE(organization_id, sku)
);

-- Índices para performance e validação
CREATE INDEX IF NOT EXISTS idx_products_organization_id ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_organization_name ON products(organization_name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(organization_id, category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(organization_id, sku) WHERE sku IS NOT NULL;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_products_updated_at();

-- Comentários para documentação
COMMENT ON TABLE products IS 'Tabela de produtos/serviços com validação robusta de organização';
COMMENT ON COLUMN products.organization_id IS 'ID da organização (obrigatório, validado via Supabase)';
COMMENT ON COLUMN products.organization_name IS 'Nome da organização (sincronizado com Supabase)';
COMMENT ON COLUMN products.created_by_name IS 'Nome do usuário que criou o produto (para auditoria)';
COMMENT ON COLUMN products.updated_by_name IS 'Nome do usuário que modificou o produto (para auditoria)';


-- Migration: Criar tabela de serviços no PostgreSQL
-- Esta migration deve ser executada no PostgreSQL do servidor Hetzner
-- NÃO executar no Supabase
-- Data: 2025-12-20

-- Criar extensão UUID se não existir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar tabela de serviços
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL, -- Referência ao Supabase (não é FK pois está em outro banco)
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    category TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_services_organization ON services(organization_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(organization_id, category);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(organization_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_services_name ON services(organization_id, name);

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_services_updated_at ON services;
CREATE TRIGGER update_services_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários nas colunas
COMMENT ON TABLE services IS 'Tabela de serviços para o gerador de orçamento';
COMMENT ON COLUMN services.id IS 'ID único do serviço (UUID)';
COMMENT ON COLUMN services.organization_id IS 'ID da organização no Supabase';
COMMENT ON COLUMN services.name IS 'Nome do serviço';
COMMENT ON COLUMN services.description IS 'Descrição detalhada do serviço';
COMMENT ON COLUMN services.price IS 'Preço do serviço';
COMMENT ON COLUMN services.category IS 'Categoria do serviço';
COMMENT ON COLUMN services.is_active IS 'Indica se o serviço está ativo';

-- Inserir alguns dados de exemplo (opcional)
-- INSERT INTO services (organization_id, name, description, price, category) VALUES
-- ('00000000-0000-0000-0000-000000000000', 'Serviço Exemplo 1', 'Descrição do serviço exemplo', 100.00, 'Categoria 1'),
-- ('00000000-0000-0000-0000-000000000000', 'Serviço Exemplo 2', 'Descrição do serviço exemplo 2', 200.00, 'Categoria 2');



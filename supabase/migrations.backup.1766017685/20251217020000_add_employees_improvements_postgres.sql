-- Migration: Adicionar melhorias ao sistema de colaboradores
-- Esta migration deve ser executada no PostgreSQL do servidor Hetzner
-- NÃO executar no Supabase
-- Data: 2025-12-17

-- ============================================
-- ADICIONAR CAMPOS EM positions (Cargos)
-- ============================================
ALTER TABLE positions
ADD COLUMN IF NOT EXISTS hierarchical_level TEXT CHECK (hierarchical_level IN ('junior', 'pleno', 'senior', 'gerente', 'diretor')),
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS requirements TEXT,
ADD COLUMN IF NOT EXISTS salary_min NUMERIC(12, 2),
ADD COLUMN IF NOT EXISTS salary_max NUMERIC(12, 2);

-- Comentários para documentação
COMMENT ON COLUMN positions.hierarchical_level IS 'Nível hierárquico: junior, pleno, sênior, gerente, diretor';
COMMENT ON COLUMN positions.department IS 'Departamento/setor do cargo';
COMMENT ON COLUMN positions.requirements IS 'Requisitos e qualificações necessárias';
COMMENT ON COLUMN positions.salary_min IS 'Faixa salarial mínima';
COMMENT ON COLUMN positions.salary_max IS 'Faixa salarial máxima';

-- ============================================
-- ADICIONAR CAMPOS EM employees (Funcionários)
-- ============================================
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS ctps TEXT,
ADD COLUMN IF NOT EXISTS pis TEXT;

-- Comentários para documentação
COMMENT ON COLUMN employees.emergency_contact_name IS 'Nome do contato de emergência';
COMMENT ON COLUMN employees.emergency_contact_phone IS 'Telefone do contato de emergência';
COMMENT ON COLUMN employees.ctps IS 'Número da CTPS (Carteira de Trabalho)';
COMMENT ON COLUMN employees.pis IS 'Número do PIS';

-- ============================================
-- TABELA: employee_dependents (Dependentes)
-- ============================================
CREATE TABLE IF NOT EXISTS employee_dependents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL CHECK (relationship IN ('filho', 'filha', 'conjuge', 'pai', 'mae', 'outro')),
    birth_date DATE,
    cpf TEXT,
    is_ir_dependent BOOLEAN DEFAULT false, -- Dependente para Imposto de Renda
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para employee_dependents
CREATE INDEX IF NOT EXISTS idx_dependents_employee ON employee_dependents(employee_id);
CREATE INDEX IF NOT EXISTS idx_dependents_cpf ON employee_dependents(cpf) WHERE cpf IS NOT NULL;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_dependents_updated_at ON employee_dependents;
CREATE TRIGGER update_dependents_updated_at
    BEFORE UPDATE ON employee_dependents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABELA: employee_documents (Documentos Adicionais)
-- ============================================
CREATE TABLE IF NOT EXISTS employee_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('cnh', 'passaporte', 'titulo_eleitor', 'certidao_nascimento', 'certidao_casamento', 'outro')),
    document_number TEXT,
    issue_date DATE,
    expiry_date DATE,
    issuing_authority TEXT,
    file_url TEXT, -- URL do arquivo no storage (opcional)
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para employee_documents
CREATE INDEX IF NOT EXISTS idx_documents_employee ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON employee_documents(employee_id, document_type);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_documents_updated_at ON employee_documents;
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON employee_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABELA: employee_benefits (Benefícios)
-- ============================================
CREATE TABLE IF NOT EXISTS employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('plano_saude', 'plano_odontologico', 'vale_refeicao', 'vale_alimentacao', 'vale_transporte', 'auxilio_creche', 'gympass', 'outro')),
    provider TEXT, -- Nome do fornecedor/plano
    plan_name TEXT, -- Nome do plano
    value NUMERIC(12, 2), -- Valor do benefício (se aplicável)
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT benefits_dates_check CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Índices para employee_benefits
CREATE INDEX IF NOT EXISTS idx_benefits_employee ON employee_benefits(employee_id);
CREATE INDEX IF NOT EXISTS idx_benefits_type ON employee_benefits(employee_id, benefit_type);
CREATE INDEX IF NOT EXISTS idx_benefits_active ON employee_benefits(employee_id, is_active) WHERE is_active = true;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_benefits_updated_at ON employee_benefits;
CREATE TRIGGER update_benefits_updated_at
    BEFORE UPDATE ON employee_benefits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================
COMMENT ON TABLE employee_dependents IS 'Tabela de dependentes dos funcionários';
COMMENT ON TABLE employee_documents IS 'Tabela de documentos adicionais dos funcionários';
COMMENT ON TABLE employee_benefits IS 'Tabela de benefícios dos funcionários';

COMMENT ON COLUMN employee_dependents.relationship IS 'Relação com o funcionário: filho, filha, conjuge, pai, mae, outro';
COMMENT ON COLUMN employee_dependents.is_ir_dependent IS 'Se o dependente é declarado no Imposto de Renda';
COMMENT ON COLUMN employee_documents.document_type IS 'Tipo de documento: cnh, passaporte, titulo_eleitor, certidao_nascimento, certidao_casamento, outro';
COMMENT ON COLUMN employee_benefits.benefit_type IS 'Tipo de benefício: plano_saude, plano_odontologico, vale_refeicao, vale_alimentacao, vale_transporte, auxilio_creche, gympass, outro';



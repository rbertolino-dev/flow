-- Migration: Criar sistema de gestão de colaboradores no PostgreSQL
-- Esta migration deve ser executada no PostgreSQL do servidor Hetzner
-- NÃO executar no Supabase
-- Data: 2025-12-17

-- Criar extensão UUID se não existir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABELA: positions (Cargos)
-- ============================================
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL, -- Referência ao Supabase (não é FK pois está em outro banco)
    name TEXT NOT NULL,
    description TEXT,
    base_salary NUMERIC(12, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT positions_name_org_unique UNIQUE (organization_id, name)
);

-- Índices para positions
CREATE INDEX IF NOT EXISTS idx_positions_organization ON positions(organization_id);
CREATE INDEX IF NOT EXISTS idx_positions_active ON positions(organization_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_positions_name ON positions(organization_id, name);

-- ============================================
-- TABELA: employees (Funcionários)
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL, -- Referência ao Supabase
    user_id UUID, -- Referência opcional ao Supabase (auth.users)
    
    -- Dados pessoais
    full_name TEXT NOT NULL,
    cpf TEXT NOT NULL,
    rg TEXT,
    birth_date DATE,
    phone TEXT,
    email TEXT,
    
    -- Endereço
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    
    -- Dados profissionais
    admission_date DATE NOT NULL,
    dismissal_date DATE,
    status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'afastado')),
    current_position_id UUID REFERENCES positions(id) ON DELETE SET NULL,
    
    -- Dados bancários
    bank_name TEXT,
    bank_agency TEXT,
    bank_account TEXT,
    account_type TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraints
    CONSTRAINT employees_cpf_org_unique UNIQUE (organization_id, cpf),
    CONSTRAINT employees_admission_date_check CHECK (admission_date <= CURRENT_DATE),
    CONSTRAINT employees_dismissal_date_check CHECK (dismissal_date IS NULL OR dismissal_date >= admission_date)
);

-- Índices para employees
CREATE INDEX IF NOT EXISTS idx_employees_organization ON employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_cpf ON employees(organization_id, cpf);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_employees_position ON employees(current_position_id) WHERE current_position_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(organization_id, full_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_email_org_unique ON employees(organization_id, email) WHERE email IS NOT NULL AND email != '';

-- ============================================
-- TABELA: teams (Equipes)
-- ============================================
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL, -- Referência ao Supabase
    name TEXT NOT NULL,
    description TEXT,
    manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT teams_name_org_unique UNIQUE (organization_id, name)
);

-- Índices para teams
CREATE INDEX IF NOT EXISTS idx_teams_organization ON teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_manager ON teams(manager_id) WHERE manager_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(organization_id, name);

-- ============================================
-- TABELA: employee_salary_history (Histórico de Salários)
-- ============================================
CREATE TABLE IF NOT EXISTS employee_salary_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    salary NUMERIC(12, 2) NOT NULL CHECK (salary > 0),
    effective_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID -- Referência ao Supabase (auth.users)
);

-- Índices para employee_salary_history
CREATE INDEX IF NOT EXISTS idx_salary_history_employee ON employee_salary_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_history_date ON employee_salary_history(employee_id, effective_date DESC);

-- ============================================
-- TABELA: employee_position_history (Histórico de Cargos)
-- ============================================
CREATE TABLE IF NOT EXISTS employee_position_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID, -- Referência ao Supabase (auth.users)
    CONSTRAINT position_history_dates_check CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Índices para employee_position_history
CREATE INDEX IF NOT EXISTS idx_position_history_employee ON employee_position_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_position_history_position ON employee_position_history(position_id);
CREATE INDEX IF NOT EXISTS idx_position_history_dates ON employee_position_history(employee_id, start_date DESC);

-- ============================================
-- TABELA: employee_teams (Relacionamento Many-to-Many)
-- ============================================
CREATE TABLE IF NOT EXISTS employee_teams (
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
    left_at DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (employee_id, team_id),
    CONSTRAINT employee_teams_dates_check CHECK (left_at IS NULL OR left_at >= joined_at)
);

-- Índices para employee_teams
CREATE INDEX IF NOT EXISTS idx_employee_teams_employee ON employee_teams(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_teams_team ON employee_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_employee_teams_active ON employee_teams(team_id, is_active) WHERE is_active = true;

-- ============================================
-- TRIGGERS: Atualizar updated_at automaticamente
-- ============================================
-- Função já deve existir da migration de services, mas vamos garantir
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_positions_updated_at ON positions;
CREATE TRIGGER update_positions_updated_at
    BEFORE UPDATE ON positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================
COMMENT ON TABLE positions IS 'Tabela de cargos/funções dos funcionários';
COMMENT ON TABLE employees IS 'Tabela de funcionários/colaboradores';
COMMENT ON TABLE teams IS 'Tabela de equipes';
COMMENT ON TABLE employee_salary_history IS 'Histórico de alterações salariais dos funcionários';
COMMENT ON TABLE employee_position_history IS 'Histórico de mudanças de cargo dos funcionários';
COMMENT ON TABLE employee_teams IS 'Relacionamento many-to-many entre funcionários e equipes';

COMMENT ON COLUMN employees.organization_id IS 'ID da organização no Supabase';
COMMENT ON COLUMN employees.user_id IS 'ID do usuário no Supabase (opcional - para funcionários que são usuários do sistema)';
COMMENT ON COLUMN employees.status IS 'Status do funcionário: ativo, inativo ou afastado';
COMMENT ON COLUMN employee_salary_history.created_by IS 'ID do usuário que registrou a alteração salarial';
COMMENT ON COLUMN employee_position_history.created_by IS 'ID do usuário que registrou a mudança de cargo';


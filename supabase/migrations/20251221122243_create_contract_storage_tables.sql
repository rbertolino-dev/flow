-- ============================================
-- TABELAS PARA SISTEMA MULTI-STORAGE E BACKUP
-- ============================================

-- 1. Tabela de Backups de Contratos
CREATE TABLE IF NOT EXISTS public.contract_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  storage_type text NOT NULL CHECK (storage_type IN ('supabase', 'firebase', 's3', 'custom')),
  backup_url text NOT NULL,
  backup_type text NOT NULL CHECK (backup_type IN ('daily', 'replication', 'version')),
  version_number integer,
  file_size bigint NOT NULL DEFAULT 0, -- tamanho em bytes
  checksum text, -- hash SHA-256 para validação de integridade
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Índices
  CONSTRAINT idx_contract_backups_contract UNIQUE(contract_id, backup_type, version_number)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contract_backups_contract_id ON public.contract_backups(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_backups_type ON public.contract_backups(backup_type);
CREATE INDEX IF NOT EXISTS idx_contract_backups_storage_type ON public.contract_backups(storage_type);
CREATE INDEX IF NOT EXISTS idx_contract_backups_created_at ON public.contract_backups(created_at);

-- 2. Tabela de Migrações de Storage
CREATE TABLE IF NOT EXISTS public.contract_storage_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  from_storage text NOT NULL CHECK (from_storage IN ('supabase', 'firebase', 's3', 'custom')),
  to_storage text NOT NULL CHECK (to_storage IN ('supabase', 'firebase', 's3', 'custom')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  error_message text,
  old_url text, -- URL antiga
  new_url text, -- URL nova
  file_size bigint, -- tamanho do arquivo migrado
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contract_storage_migrations_contract_id ON public.contract_storage_migrations(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_storage_migrations_status ON public.contract_storage_migrations(status);
CREATE INDEX IF NOT EXISTS idx_contract_storage_migrations_created_at ON public.contract_storage_migrations(created_at);

-- 3. Tabela de Uso de Storage por Organização
CREATE TABLE IF NOT EXISTS public.contract_storage_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  storage_type text NOT NULL CHECK (storage_type IN ('supabase', 'firebase', 's3', 'custom')),
  total_bytes bigint NOT NULL DEFAULT 0, -- total de bytes usados
  total_files integer NOT NULL DEFAULT 0, -- total de arquivos
  period_start timestamptz NOT NULL, -- início do período (ex: início do mês)
  period_end timestamptz NOT NULL, -- fim do período (ex: fim do mês)
  period_type text NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Uma entrada por organização, storage_type e período
  CONSTRAINT unique_contract_storage_usage UNIQUE(organization_id, storage_type, period_start, period_type)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contract_storage_usage_org ON public.contract_storage_usage(organization_id);
CREATE INDEX IF NOT EXISTS idx_contract_storage_usage_storage_type ON public.contract_storage_usage(storage_type);
CREATE INDEX IF NOT EXISTS idx_contract_storage_usage_period ON public.contract_storage_usage(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_contract_storage_usage_period_type ON public.contract_storage_usage(period_type);

-- 4. Tabela de Cobrança por Armazenamento
CREATE TABLE IF NOT EXISTS public.contract_storage_billing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  storage_type text NOT NULL CHECK (storage_type IN ('supabase', 'firebase', 's3', 'custom')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  total_gb numeric(10, 4) NOT NULL DEFAULT 0, -- total em GB (com 4 casas decimais)
  price_per_gb numeric(10, 4) NOT NULL DEFAULT 0, -- preço por GB configurado
  total_cost numeric(10, 2) NOT NULL DEFAULT 0, -- custo total (preço * GB)
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'calculated', 'billed', 'paid', 'cancelled')),
  invoice_number text, -- número da fatura (se aplicável)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Uma cobrança por organização, storage_type e período
  CONSTRAINT unique_contract_storage_billing UNIQUE(organization_id, storage_type, period_start, period_end)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contract_storage_billing_org ON public.contract_storage_billing(organization_id);
CREATE INDEX IF NOT EXISTS idx_contract_storage_billing_storage_type ON public.contract_storage_billing(storage_type);
CREATE INDEX IF NOT EXISTS idx_contract_storage_billing_period ON public.contract_storage_billing(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_contract_storage_billing_status ON public.contract_storage_billing(status);

-- 5. Tabela de Configuração de Preços por GB (configurada pelo Super Admin)
CREATE TABLE IF NOT EXISTS public.contract_storage_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_type text NOT NULL UNIQUE CHECK (storage_type IN ('supabase', 'firebase', 's3', 'custom')),
  price_per_gb numeric(10, 4) NOT NULL DEFAULT 0, -- preço por GB
  currency text NOT NULL DEFAULT 'USD',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Inserir preços padrão
INSERT INTO public.contract_storage_pricing (storage_type, price_per_gb, currency, is_active)
VALUES
  ('supabase', 0.021, 'USD', true),
  ('firebase', 0.026, 'USD', true),
  ('s3', 0.023, 'USD', true)
ON CONFLICT (storage_type) DO NOTHING;

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Dropar triggers se existirem antes de criar
DROP TRIGGER IF EXISTS update_contract_storage_usage_updated_at ON public.contract_storage_usage;
CREATE TRIGGER update_contract_storage_usage_updated_at
  BEFORE UPDATE ON public.contract_storage_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contract_storage_billing_updated_at ON public.contract_storage_billing;
CREATE TRIGGER update_contract_storage_billing_updated_at
  BEFORE UPDATE ON public.contract_storage_billing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contract_storage_pricing_updated_at ON public.contract_storage_pricing;
CREATE TRIGGER update_contract_storage_pricing_updated_at
  BEFORE UPDATE ON public.contract_storage_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE public.contract_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_storage_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_storage_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_storage_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_storage_pricing ENABLE ROW LEVEL SECURITY;

-- Policies para contract_backups
DROP POLICY IF EXISTS "Users can view backups of their organization contracts" ON public.contract_backups;
CREATE POLICY "Users can view backups of their organization contracts"
  ON public.contract_backups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      JOIN public.organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = contract_backups.contract_id
        AND om.user_id = auth.uid()
    )
  );

-- Policies para contract_storage_migrations
DROP POLICY IF EXISTS "Users can view migrations of their organization contracts" ON public.contract_storage_migrations;
CREATE POLICY "Users can view migrations of their organization contracts"
  ON public.contract_storage_migrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      JOIN public.organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = contract_storage_migrations.contract_id
        AND om.user_id = auth.uid()
    )
  );

-- Policies para contract_storage_usage
DROP POLICY IF EXISTS "Users can view storage usage of their organization" ON public.contract_storage_usage;
CREATE POLICY "Users can view storage usage of their organization"
  ON public.contract_storage_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = contract_storage_usage.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- Policies para contract_storage_billing
DROP POLICY IF EXISTS "Users can view billing of their organization" ON public.contract_storage_billing;
CREATE POLICY "Users can view billing of their organization"
  ON public.contract_storage_billing FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = contract_storage_billing.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- Policies para contract_storage_pricing (apenas Admin pode ver/editar)
DROP POLICY IF EXISTS "Admins can manage storage pricing" ON public.contract_storage_pricing;
CREATE POLICY "Admins can manage storage pricing"
  ON public.contract_storage_pricing FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Comentários
COMMENT ON TABLE public.contract_backups IS 'Backups de PDFs de contratos (diário, replicação, versionamento)';
COMMENT ON TABLE public.contract_storage_migrations IS 'Histórico de migrações de contratos entre storages';
COMMENT ON TABLE public.contract_storage_usage IS 'Uso de armazenamento por organização (GB usado por período)';
COMMENT ON TABLE public.contract_storage_billing IS 'Cobrança por armazenamento usado por organização';
COMMENT ON TABLE public.contract_storage_pricing IS 'Preços por GB configurados pelo Super Admin para cada tipo de storage';


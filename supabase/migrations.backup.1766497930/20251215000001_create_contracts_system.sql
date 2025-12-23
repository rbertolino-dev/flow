-- ============================================
-- SISTEMA DE CONTRATOS COM ASSINATURA DIGITAL
-- ============================================

-- 1. Tabela de Templates de Contratos
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL, -- conteúdo do template com variáveis {{nome}}, {{telefone}}, etc.
  variables JSONB DEFAULT '[]'::jsonb, -- lista de variáveis disponíveis
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Contratos Gerados
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  contract_number TEXT NOT NULL, -- número único do contrato
  content TEXT NOT NULL, -- conteúdo final com variáveis substituídas
  pdf_url TEXT, -- URL do PDF gerado
  signed_pdf_url TEXT, -- URL do PDF assinado
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ, -- data de vigência
  signed_at TIMESTAMPTZ, -- data de assinatura
  sent_at TIMESTAMPTZ, -- data de envio
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, contract_number)
);

-- 3. Tabela de Assinaturas
CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  signer_type TEXT NOT NULL CHECK (signer_type IN ('user', 'client')),
  signer_name TEXT NOT NULL,
  signature_data TEXT NOT NULL, -- base64 da assinatura
  signed_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT -- opcional para auditoria
);

-- 4. Tabela de Configuração de Storage (Super Admin)
CREATE TABLE IF NOT EXISTS public.contract_storage_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE, -- NULL para global
  storage_type TEXT NOT NULL CHECK (storage_type IN ('supabase', 'firebase', 's3', 'custom')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb, -- configurações específicas do storage
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contract_templates_org ON public.contract_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_contract_templates_active ON public.contract_templates(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_contracts_org_status ON public.contracts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_lead ON public.contracts(lead_id);
CREATE INDEX IF NOT EXISTS idx_contracts_number ON public.contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_contracts_expires ON public.contracts(expires_at);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract ON public.contract_signatures(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_storage_config_org ON public.contract_storage_config(organization_id);
CREATE INDEX IF NOT EXISTS idx_contract_storage_config_active ON public.contract_storage_config(is_active) WHERE is_active = true;

-- Habilitar RLS
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_storage_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies para contract_templates
CREATE POLICY "Users can view templates in their org"
ON public.contract_templates FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can insert templates in their org"
ON public.contract_templates FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update templates in their org"
ON public.contract_templates FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete templates in their org"
ON public.contract_templates FOR DELETE
USING (
  public.user_is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- RLS Policies para contracts
CREATE POLICY "Users can view contracts in their org"
ON public.contracts FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can insert contracts in their org"
ON public.contracts FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update contracts in their org"
ON public.contracts FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete contracts in their org"
ON public.contracts FOR DELETE
USING (
  public.user_is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- RLS Policies para contract_signatures
CREATE POLICY "Users can view signatures of contracts in their org"
ON public.contract_signatures FOR SELECT
USING (
  contract_id IN (
    SELECT id FROM public.contracts 
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can insert signatures for contracts in their org"
ON public.contract_signatures FOR INSERT
WITH CHECK (
  contract_id IN (
    SELECT id FROM public.contracts 
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- RLS Policies para contract_storage_config
CREATE POLICY "Super admins can view all storage configs"
ON public.contract_storage_config FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
  OR (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  )
);

CREATE POLICY "Super admins can manage storage configs"
ON public.contract_storage_config FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

-- Triggers para updated_at
CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contract_storage_config_updated_at
  BEFORE UPDATE ON public.contract_storage_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para gerar número de contrato único
CREATE OR REPLACE FUNCTION public.generate_contract_number(_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT;
  v_date TEXT;
  v_seq INTEGER;
  v_number TEXT;
BEGIN
  -- Prefixo baseado no ID da organização (primeiros 4 caracteres)
  v_prefix := UPPER(SUBSTRING(_org_id::TEXT, 1, 4));
  
  -- Data no formato YYYYMMDD
  v_date := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Sequencial do dia (contar contratos criados hoje)
  SELECT COALESCE(MAX(CAST(SUBSTRING(contract_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO v_seq
  FROM public.contracts
  WHERE organization_id = _org_id
    AND contract_number LIKE v_prefix || '-' || v_date || '-%'
    AND DATE(created_at) = CURRENT_DATE;
  
  -- Formato: ORG-YYYYMMDD-XXXX
  v_number := v_prefix || '-' || v_date || '-' || LPAD(v_seq::TEXT, 4, '0');
  
  RETURN v_number;
END;
$$;

-- Comentários nas tabelas
COMMENT ON TABLE public.contract_templates IS 'Templates de contratos com variáveis do CRM';
COMMENT ON TABLE public.contracts IS 'Contratos gerados a partir dos templates';
COMMENT ON TABLE public.contract_signatures IS 'Assinaturas digitais capturadas via canvas';
COMMENT ON TABLE public.contract_storage_config IS 'Configuração de armazenamento de PDFs (configurável pelo Super Admin)';

COMMENT ON COLUMN public.contract_templates.content IS 'Conteúdo do template com variáveis no formato {{variavel}}';
COMMENT ON COLUMN public.contract_templates.variables IS 'Lista JSONB das variáveis disponíveis no template';
COMMENT ON COLUMN public.contracts.contract_number IS 'Número único do contrato no formato ORG-YYYYMMDD-XXXX';
COMMENT ON COLUMN public.contracts.status IS 'Status: draft, sent, signed, expired, cancelled';
COMMENT ON COLUMN public.contract_signatures.signature_data IS 'Assinatura em base64 (PNG)';
COMMENT ON COLUMN public.contract_storage_config.organization_id IS 'NULL para configuração global, UUID para configuração por organização';


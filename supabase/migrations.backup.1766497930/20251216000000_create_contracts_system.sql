-- Migração: Sistema de Contratos com Assinatura Digital
-- Permite criar templates, gerar contratos, capturar assinaturas e enviar via WhatsApp

-- Tabela de templates de contratos
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  content text NOT NULL, -- conteúdo do template com variáveis {{nome}}, {{telefone}}, etc.
  variables jsonb DEFAULT '[]'::jsonb, -- lista de variáveis disponíveis no template
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de contratos gerados
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  contract_number text NOT NULL UNIQUE, -- número único do contrato (ex: ORG-20251216-0001)
  content text NOT NULL, -- conteúdo final com variáveis substituídas
  pdf_url text, -- URL do PDF gerado (não assinado)
  signed_pdf_url text, -- URL do PDF assinado
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'expired', 'cancelled')),
  expires_at timestamptz, -- data de vigência do contrato
  signed_at timestamptz, -- data de assinatura
  sent_at timestamptz, -- data de envio
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de assinaturas capturadas
CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  signer_type text NOT NULL CHECK (signer_type IN ('user', 'client')), -- quem assinou: usuário do sistema ou cliente
  signer_name text NOT NULL, -- nome do signatário
  signature_data text NOT NULL, -- base64 da assinatura (PNG)
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text, -- opcional para auditoria
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de configuração de armazenamento (Super Admin)
CREATE TABLE IF NOT EXISTS public.contract_storage_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE, -- nullable para configuração global
  storage_type text NOT NULL CHECK (storage_type IN ('supabase', 'firebase', 's3', 'custom')), -- tipo de storage
  config jsonb NOT NULL DEFAULT '{}'::jsonb, -- configurações específicas do storage (chaves, buckets, etc.)
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id) -- uma configuração por organização (ou global se organization_id é null)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contract_templates_org ON public.contract_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_contract_templates_active ON public.contract_templates(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_contracts_org_status ON public.contracts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_lead ON public.contracts(lead_id);
CREATE INDEX IF NOT EXISTS idx_contracts_number ON public.contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_contracts_template ON public.contracts(template_id);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract ON public.contract_signatures(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_storage_config_org ON public.contract_storage_config(organization_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contract_templates_updated_at BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contract_storage_config_updated_at BEFORE UPDATE ON public.contract_storage_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para gerar número de contrato único
CREATE OR REPLACE FUNCTION generate_contract_number(p_org_id uuid)
RETURNS text AS $$
DECLARE
  v_org_prefix text;
  v_date_prefix text;
  v_sequence_num integer;
  v_contract_number text;
BEGIN
  -- Obter prefixo da organização (primeiras 3 letras do nome ou ID)
  SELECT COALESCE(
    UPPER(SUBSTRING(name FROM 1 FOR 3)),
    UPPER(SUBSTRING(id::text FROM 1 FOR 3))
  ) INTO v_org_prefix
  FROM public.organizations
  WHERE id = p_org_id;
  
  -- Formato de data: YYYYMMDD
  v_date_prefix := TO_CHAR(now(), 'YYYYMMDD');
  
  -- Contar contratos criados hoje para esta organização
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(contract_number FROM '[0-9]+$') AS INTEGER)
  ), 0) + 1 INTO v_sequence_num
  FROM public.contracts
  WHERE organization_id = p_org_id
    AND contract_number LIKE v_org_prefix || '-' || v_date_prefix || '-%';
  
  -- Formatar número: ORG-YYYYMMDD-XXXX (4 dígitos)
  v_contract_number := v_org_prefix || '-' || v_date_prefix || '-' || LPAD(v_sequence_num::text, 4, '0');
  
  RETURN v_contract_number;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies

-- contract_templates
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view templates from their organization"
ON public.contract_templates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create templates in their organization"
ON public.contract_templates FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update templates in their organization"
ON public.contract_templates FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can delete templates"
ON public.contract_templates FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
  )
);

-- contracts
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contracts from their organization"
ON public.contracts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create contracts in their organization"
ON public.contracts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update contracts in their organization"
ON public.contracts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can delete contracts"
ON public.contracts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
  )
);

-- contract_signatures
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view signatures from their organization"
ON public.contract_signatures FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_signatures.contract_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create signatures for contracts in their organization"
ON public.contract_signatures FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_signatures.contract_id
      AND om.user_id = auth.uid()
  )
);

-- contract_storage_config
ALTER TABLE public.contract_storage_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all storage configs"
ON public.contract_storage_config FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Super admins can manage storage configs"
ON public.contract_storage_config FOR ALL
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

-- Comentários nas tabelas
COMMENT ON TABLE public.contract_templates IS 'Templates de contratos com variáveis do CRM';
COMMENT ON TABLE public.contracts IS 'Contratos gerados a partir dos templates';
COMMENT ON TABLE public.contract_signatures IS 'Assinaturas digitais capturadas via canvas';
COMMENT ON TABLE public.contract_storage_config IS 'Configuração de armazenamento de PDFs (configurável pelo Super Admin)';



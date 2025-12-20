-- ============================================
-- FIX: Verificar e corrigir módulo Contratos
-- Execute no Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Garantir que função update_updated_at_column existe
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- 2. Criar tabela contract_templates
-- ============================================
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL, -- conteúdo do template com variáveis {{nome}}, {{telefone}}, etc.
  variables JSONB DEFAULT '[]'::jsonb, -- lista de variáveis disponíveis no template
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para contract_templates
CREATE INDEX IF NOT EXISTS idx_contract_templates_org ON public.contract_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_contract_templates_active ON public.contract_templates(organization_id, is_active);

-- ============================================
-- 3. Criar tabela contracts
-- ============================================
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  contract_number TEXT NOT NULL UNIQUE, -- número único do contrato (ex: ORG-20251216-0001)
  content TEXT NOT NULL, -- conteúdo final com variáveis substituídas
  pdf_url TEXT, -- URL do PDF gerado (não assinado)
  signed_pdf_url TEXT, -- URL do PDF assinado
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ, -- data de vigência do contrato
  signed_at TIMESTAMPTZ, -- data de assinatura
  sent_at TIMESTAMPTZ, -- data de envio
  created_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para contracts
CREATE INDEX IF NOT EXISTS idx_contracts_org_status ON public.contracts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_lead ON public.contracts(lead_id);
CREATE INDEX IF NOT EXISTS idx_contracts_number ON public.contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_contracts_template ON public.contracts(template_id);

-- ============================================
-- 4. Criar tabela contract_signatures
-- ============================================
CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  signer_type TEXT NOT NULL CHECK (signer_type IN ('user', 'client')), -- quem assinou: usuário do sistema ou cliente
  signer_name TEXT NOT NULL, -- nome do signatário
  signature_data TEXT NOT NULL, -- base64 da assinatura (PNG)
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT, -- opcional para auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para contract_signatures
CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract ON public.contract_signatures(contract_id);

-- ============================================
-- 5. Criar tabela contract_storage_config
-- ============================================
CREATE TABLE IF NOT EXISTS public.contract_storage_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE, -- nullable para configuração global
  storage_type TEXT NOT NULL CHECK (storage_type IN ('supabase', 'firebase', 's3', 'custom')), -- tipo de storage
  config JSONB NOT NULL DEFAULT '{}'::jsonb, -- configurações específicas do storage (chaves, buckets, etc.)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_contract_storage_config_org UNIQUE(organization_id) -- uma configuração por organização (ou global se organization_id é null)
);

-- Índices para contract_storage_config
CREATE INDEX IF NOT EXISTS idx_contract_storage_config_org ON public.contract_storage_config(organization_id);

-- ============================================
-- 6. RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_storage_config ENABLE ROW LEVEL SECURITY;

-- Policies para contract_templates
DROP POLICY IF EXISTS "Users can view templates from their org" ON public.contract_templates;
CREATE POLICY "Users can view templates from their org"
  ON public.contract_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = contract_templates.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert templates in their org" ON public.contract_templates;
CREATE POLICY "Users can insert templates in their org"
  ON public.contract_templates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = contract_templates.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update templates in their org" ON public.contract_templates;
CREATE POLICY "Users can update templates in their org"
  ON public.contract_templates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = contract_templates.organization_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = contract_templates.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete templates in their org" ON public.contract_templates;
CREATE POLICY "Users can delete templates in their org"
  ON public.contract_templates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = contract_templates.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- Policies para contracts
DROP POLICY IF EXISTS "Users can view contracts from their org" ON public.contracts;
CREATE POLICY "Users can view contracts from their org"
  ON public.contracts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = contracts.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert contracts in their org" ON public.contracts;
CREATE POLICY "Users can insert contracts in their org"
  ON public.contracts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = contracts.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update contracts in their org" ON public.contracts;
CREATE POLICY "Users can update contracts in their org"
  ON public.contracts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = contracts.organization_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = contracts.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete contracts in their org" ON public.contracts;
CREATE POLICY "Users can delete contracts in their org"
  ON public.contracts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = contracts.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- Policies para contract_signatures
DROP POLICY IF EXISTS "Users can view signatures from their org" ON public.contract_signatures;
CREATE POLICY "Users can view signatures from their org"
  ON public.contract_signatures FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.contracts c
      JOIN public.organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = contract_signatures.contract_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert signatures in their org" ON public.contract_signatures;
CREATE POLICY "Users can insert signatures in their org"
  ON public.contract_signatures FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.contracts c
      JOIN public.organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = contract_signatures.contract_id
        AND om.user_id = auth.uid()
    )
  );

-- Policies para contract_storage_config
DROP POLICY IF EXISTS "Users can view storage config" ON public.contract_storage_config;
CREATE POLICY "Users can view storage config"
  ON public.contract_storage_config FOR SELECT
  USING (
    organization_id IS NULL -- Configuração global visível para todos
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = contract_storage_config.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Super admins can manage storage config" ON public.contract_storage_config;
CREATE POLICY "Super admins can manage storage config"
  ON public.contract_storage_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND LOWER(o.name) LIKE '%pubdigital%'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND LOWER(o.name) LIKE '%pubdigital%'
    )
  );

-- ============================================
-- 7. Função para gerar número de contrato único
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_contract_number(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_prefix TEXT;
  v_date_prefix TEXT;
  v_sequence_num INTEGER;
  v_contract_number TEXT;
BEGIN
  -- Obter prefixo da organização (primeiras 3 letras do nome ou ID)
  SELECT COALESCE(
    UPPER(SUBSTRING(name FROM 1 FOR 3)),
    UPPER(SUBSTRING(id::text FROM 1 FOR 3))
  ) INTO v_org_prefix
  FROM public.organizations
  WHERE id = p_org_id;
  
  -- Se não encontrou organização, usar prefixo padrão
  IF v_org_prefix IS NULL THEN
    v_org_prefix := 'ORG';
  END IF;
  
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
$$;

-- ============================================
-- 8. Triggers para updated_at
-- ============================================

-- Trigger para contract_templates
DROP TRIGGER IF EXISTS update_contract_templates_updated_at ON public.contract_templates;
CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para contracts
DROP TRIGGER IF EXISTS update_contracts_updated_at ON public.contracts;
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para contract_storage_config
DROP TRIGGER IF EXISTS update_contract_storage_config_updated_at ON public.contract_storage_config;
CREATE TRIGGER update_contract_storage_config_updated_at
  BEFORE UPDATE ON public.contract_storage_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 9. Adicionar tabelas ao realtime (opcional)
-- ============================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.contract_templates;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.contracts;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ============================================
-- 10. Comentários explicativos
-- ============================================
COMMENT ON TABLE public.contract_templates IS 'Templates de contratos com variáveis substituíveis';
COMMENT ON TABLE public.contracts IS 'Contratos gerados a partir de templates';
COMMENT ON TABLE public.contract_signatures IS 'Assinaturas digitais capturadas dos contratos';
COMMENT ON TABLE public.contract_storage_config IS 'Configuração de armazenamento de PDFs (global ou por organização)';
COMMENT ON COLUMN public.contract_templates.content IS 'Conteúdo do template com variáveis no formato {{variavel}}';
COMMENT ON COLUMN public.contract_templates.variables IS 'Lista JSONB das variáveis disponíveis no template';
COMMENT ON COLUMN public.contracts.contract_number IS 'Número único do contrato no formato ORG-YYYYMMDD-XXXX';
COMMENT ON COLUMN public.contracts.status IS 'Status: draft, sent, signed, expired, cancelled';
COMMENT ON COLUMN public.contract_signatures.signature_data IS 'Assinatura em base64 (PNG)';
COMMENT ON COLUMN public.contract_storage_config.organization_id IS 'NULL para configuração global, UUID para configuração por organização';

-- ============================================
-- 11. Forçar refresh do cache PostgREST
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- 12. Verificar resultado
-- ============================================
SELECT 
  'contract_templates' as tabela,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'contract_templates'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'contract_templates' 
      AND column_name = 'content'
  ) THEN '✅ Colunas OK' ELSE '❌ Colunas faltando' END as colunas
UNION ALL
SELECT 
  'contracts',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'contracts'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'contracts' 
      AND column_name = 'contract_number'
  ) THEN '✅ Colunas OK' ELSE '❌ Colunas faltando' END
UNION ALL
SELECT 
  'contract_signatures',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'contract_signatures'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'contract_signatures' 
      AND column_name = 'signature_data'
  ) THEN '✅ Colunas OK' ELSE '❌ Colunas faltando' END
UNION ALL
SELECT 
  'contract_storage_config',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'contract_storage_config'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'contract_storage_config' 
      AND column_name = 'storage_type'
  ) THEN '✅ Colunas OK' ELSE '❌ Colunas faltando' END
UNION ALL
SELECT 
  'generate_contract_number',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' 
      AND routine_name = 'generate_contract_number'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  'Função RPC' as colunas;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Aguarde 30-60 segundos após executar para o PostgREST atualizar o cache
-- Depois recarregue a página (F5)


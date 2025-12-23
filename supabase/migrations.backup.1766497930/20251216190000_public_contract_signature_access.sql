-- ============================================
-- Migração: Permitir acesso público a contratos via signature_token
-- ============================================
-- Esta migração permite que usuários não autenticados acessem contratos
-- e assinem usando o signature_token fornecido no link
-- ============================================

-- Política pública para leitura de contratos com token válido
DROP POLICY IF EXISTS "Public can view contracts with valid signature token" ON public.contracts;

CREATE POLICY "Public can view contracts with valid signature token"
ON public.contracts FOR SELECT
TO public
USING (
  signature_token IS NOT NULL
  AND status != 'cancelled'
  AND (expires_at IS NULL OR expires_at > NOW())
);

-- Política pública para atualização de contratos com token válido (para marcar como assinado)
DROP POLICY IF EXISTS "Public can update contracts with valid signature token" ON public.contracts;

CREATE POLICY "Public can update contracts with valid signature token"
ON public.contracts FOR UPDATE
TO public
USING (
  signature_token IS NOT NULL
  AND status != 'cancelled'
  AND status != 'signed'
  AND (expires_at IS NULL OR expires_at > NOW())
)
WITH CHECK (
  signature_token IS NOT NULL
  AND status != 'cancelled'
);

-- Política pública para inserção de assinaturas (quando há token válido)
DROP POLICY IF EXISTS "Public can insert signatures with valid contract token" ON public.contract_signatures;

CREATE POLICY "Public can insert signatures with valid contract token"
ON public.contract_signatures FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_signatures.contract_id
      AND c.signature_token IS NOT NULL
      AND c.status != 'cancelled'
      AND (c.expires_at IS NULL OR c.expires_at > NOW())
  )
);

-- Política pública para leitura de assinaturas (quando há token válido no contrato)
DROP POLICY IF EXISTS "Public can view signatures with valid contract token" ON public.contract_signatures;

CREATE POLICY "Public can view signatures with valid contract token"
ON public.contract_signatures FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_signatures.contract_id
      AND c.signature_token IS NOT NULL
      AND c.status != 'cancelled'
  )
);

-- Política pública para leitura de templates relacionados (quando necessário para visualizar contrato)
DROP POLICY IF EXISTS "Public can view templates for contracts with valid token" ON public.contract_templates;

CREATE POLICY "Public can view templates for contracts with valid token"
ON public.contract_templates FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.template_id = contract_templates.id
      AND c.signature_token IS NOT NULL
      AND c.status != 'cancelled'
      AND (c.expires_at IS NULL OR c.expires_at > NOW())
  )
);

-- Política pública para leitura de leads relacionados (quando necessário para visualizar contrato)
DROP POLICY IF EXISTS "Public can view leads for contracts with valid token" ON public.leads;

CREATE POLICY "Public can view leads for contracts with valid token"
ON public.leads FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.lead_id = leads.id
      AND c.signature_token IS NOT NULL
      AND c.status != 'cancelled'
      AND (c.expires_at IS NULL OR c.expires_at > NOW())
  )
);

-- Comentários para documentação
COMMENT ON POLICY "Public can view contracts with valid signature token" ON public.contracts IS 
'Permite acesso público a contratos quando há um signature_token válido, não cancelado e não expirado';

COMMENT ON POLICY "Public can update contracts with valid signature token" ON public.contracts IS 
'Permite atualização pública de contratos (ex: marcar como assinado) quando há um signature_token válido';

COMMENT ON POLICY "Public can insert signatures with valid contract token" ON public.contract_signatures IS 
'Permite inserção pública de assinaturas quando o contrato tem um signature_token válido';

COMMENT ON POLICY "Public can view signatures with valid contract token" ON public.contract_signatures IS 
'Permite visualização pública de assinaturas quando o contrato tem um signature_token válido';



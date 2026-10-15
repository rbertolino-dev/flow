-- CPF + OTP WhatsApp na assinatura de contratos
-- Eleva evidência de identidade (assinatura eletrônica simples reforçada)

-- Tabela de OTPs (código apenas em hash)
CREATE TABLE IF NOT EXISTS public.contract_signature_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  signature_token TEXT NOT NULL,
  signer_cpf TEXT NOT NULL,
  signer_name TEXT,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  verified_at TIMESTAMPTZ,
  verification_token UUID,
  verification_token_expires_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_signature_otps_contract_token
  ON public.contract_signature_otps(contract_id, signature_token);

CREATE INDEX IF NOT EXISTS idx_contract_signature_otps_verification
  ON public.contract_signature_otps(verification_token)
  WHERE verification_token IS NOT NULL;

COMMENT ON TABLE public.contract_signature_otps IS
  'OTP WhatsApp para assinatura de contratos (código armazenado apenas como hash)';

-- Colunas de identidade em contract_signatures
ALTER TABLE public.contract_signatures
  ADD COLUMN IF NOT EXISTS signer_cpf TEXT,
  ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS otp_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_verification_method TEXT;

COMMENT ON COLUMN public.contract_signatures.signer_cpf IS 'CPF do signatário (apenas dígitos)';
COMMENT ON COLUMN public.contract_signatures.otp_verified IS 'Indica se OTP WhatsApp foi verificado';
COMMENT ON COLUMN public.contract_signatures.otp_verified_at IS 'Timestamp da verificação OTP';
COMMENT ON COLUMN public.contract_signatures.identity_verification_method IS
  'Método de verificação (ex: cpf_whatsapp_otp)';

CREATE INDEX IF NOT EXISTS idx_contract_signatures_signer_cpf
  ON public.contract_signatures(signer_cpf)
  WHERE signer_cpf IS NOT NULL;

-- RLS: apenas service role / edge functions escrevem OTPs
ALTER TABLE public.contract_signature_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view contract OTPs" ON public.contract_signature_otps;
CREATE POLICY "Org members can view contract OTPs"
ON public.contract_signature_otps FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_signature_otps.contract_id
      AND om.user_id = auth.uid()
  )
);

-- Sem INSERT/UPDATE/DELETE públicos — edge functions usam service role

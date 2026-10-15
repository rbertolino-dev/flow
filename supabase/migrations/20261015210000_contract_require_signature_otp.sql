-- Camada opcional de autenticação CPF + OTP WhatsApp por contrato/template
-- Default false = assinatura padrão (nome + canvas + termos)
-- true = exige CPF + código WhatsApp antes de assinar

ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS require_signature_otp BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS require_signature_otp BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contract_templates.require_signature_otp IS
  'Se true, contratos criados deste template exigem CPF + OTP WhatsApp na assinatura (padrão do template)';
COMMENT ON COLUMN public.contracts.require_signature_otp IS
  'Se true, o cliente deve confirmar CPF + código WhatsApp antes de assinar; se false, assinatura padrão';

-- Termos de aceite exibidos na assinatura digital (além do conteúdo do contrato)

ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS acceptance_terms TEXT;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS acceptance_terms TEXT;

COMMENT ON COLUMN public.contract_templates.acceptance_terms IS
  'Texto dos termos de aceite exibidos ao signatário antes de assinar';
COMMENT ON COLUMN public.contracts.acceptance_terms IS
  'Termos de aceite do contrato (copiados do template na criação; editáveis)';

-- Auditoria do aceite na assinatura
ALTER TABLE public.contract_signatures
  ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_terms_snapshot TEXT;

COMMENT ON COLUMN public.contract_signatures.accepted_terms_snapshot IS
  'Cópia dos termos aceitos no momento da assinatura';

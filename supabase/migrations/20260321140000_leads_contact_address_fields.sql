-- Campos opcionais de cadastro do contato (data de nascimento e endereço)

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS postal_code text;

COMMENT ON COLUMN public.leads.birth_date IS 'Data de nascimento do contato (opcional)';
COMMENT ON COLUMN public.leads.address IS 'Logradouro / endereço (opcional)';
COMMENT ON COLUMN public.leads.neighborhood IS 'Bairro (opcional)';
COMMENT ON COLUMN public.leads.city IS 'Cidade (opcional)';
COMMENT ON COLUMN public.leads.postal_code IS 'CEP (apenas dígitos, até 8)';

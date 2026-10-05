-- Rua continua em leads.address. Número e UF ficam em colunas próprias
-- para o preenchimento automático da NF-e de produto.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS uf text;

COMMENT ON COLUMN public.leads.address IS 'Rua / logradouro (opcional)';
COMMENT ON COLUMN public.leads.address_number IS 'Número da rua (opcional)';
COMMENT ON COLUMN public.leads.uf IS 'UF do endereço, 2 letras (opcional)';

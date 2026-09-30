-- Título editável do contrato (exibido no PDF no lugar de "CONTRATO" fixo)
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS title TEXT;

COMMENT ON COLUMN public.contracts.title IS
  'Título editável do contrato exibido no PDF. Se nulo, usa o nome do template ou "CONTRATO".';

-- Adicionar campos faltantes na tabela whatsapp_boletos
ALTER TABLE public.whatsapp_boletos 
  ADD COLUMN IF NOT EXISTS data_pagamento date,
  ADD COLUMN IF NOT EXISTS valor_pago numeric(10, 2),
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES public.profiles(id);

-- Criar índice para criado_por
CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_criado_por
  ON public.whatsapp_boletos (criado_por);

-- Comentário explicativo
COMMENT ON COLUMN public.whatsapp_boletos.data_pagamento IS 'Data em que o boleto foi pago';
COMMENT ON COLUMN public.whatsapp_boletos.valor_pago IS 'Valor efetivamente pago (pode ser diferente do valor do boleto)';
COMMENT ON COLUMN public.whatsapp_boletos.criado_por IS 'Usuário que criou o boleto no sistema';
-- Guarda a instância Evolution usada para enviar o contrato,
-- para OTP e reenvios usarem a mesma (não uma aleatória da org).

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS whatsapp_instance_id UUID REFERENCES public.evolution_config(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_whatsapp_instance_id
  ON public.contracts(whatsapp_instance_id)
  WHERE whatsapp_instance_id IS NOT NULL;

COMMENT ON COLUMN public.contracts.whatsapp_instance_id IS
  'Instância Evolution usada para enviar o contrato / OTP de assinatura';

-- Backfill: contratos já enviados usam a instância de origem do lead, se houver
UPDATE public.contracts c
SET whatsapp_instance_id = l.source_instance_id
FROM public.leads l
WHERE c.lead_id = l.id
  AND c.whatsapp_instance_id IS NULL
  AND l.source_instance_id IS NOT NULL
  AND c.status IN ('sent', 'signed', 'draft');

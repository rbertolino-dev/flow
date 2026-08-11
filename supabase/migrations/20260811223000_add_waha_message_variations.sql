-- Variações de mensagem do Disparador WAHA.
-- Mantém o modelo isolado da Evolution e preserva templates/campanhas existentes.

ALTER TABLE public.broadcast_templates_waha
  ADD COLUMN IF NOT EXISTS message_variations JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.broadcast_campaigns_waha
  ADD COLUMN IF NOT EXISTS message_variations JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.broadcast_templates_waha
  DROP CONSTRAINT IF EXISTS broadcast_templates_waha_variations_array_check;
ALTER TABLE public.broadcast_templates_waha
  ADD CONSTRAINT broadcast_templates_waha_variations_array_check
  CHECK (jsonb_typeof(message_variations) = 'array');

ALTER TABLE public.broadcast_campaigns_waha
  DROP CONSTRAINT IF EXISTS broadcast_campaigns_waha_variations_array_check;
ALTER TABLE public.broadcast_campaigns_waha
  ADD CONSTRAINT broadcast_campaigns_waha_variations_array_check
  CHECK (jsonb_typeof(message_variations) = 'array');

COMMENT ON COLUMN public.broadcast_templates_waha.message_variations IS
  'Variações alternadas sequencialmente ao montar a fila WAHA.';
COMMENT ON COLUMN public.broadcast_campaigns_waha.message_variations IS
  'Cópia das variações usadas para montar a fila isolada da campanha WAHA.';

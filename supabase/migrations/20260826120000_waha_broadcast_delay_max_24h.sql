-- Disparador WAHA: o teto de 3600s (1h) rejeitava intervalos lentos válidos
-- (ex.: 3000–4000s). Alinha o CHECK ao Disparador 2 Evolution (24h).

ALTER TABLE public.broadcast_campaigns_waha
  DROP CONSTRAINT IF EXISTS broadcast_campaigns_waha_delay_check;

ALTER TABLE public.broadcast_campaigns_waha
  ADD CONSTRAINT broadcast_campaigns_waha_delay_check
  CHECK (
    min_delay_seconds >= 5
    AND max_delay_seconds >= min_delay_seconds
    AND max_delay_seconds <= 86400
  );

ALTER TABLE public.broadcast_templates_waha
  DROP CONSTRAINT IF EXISTS broadcast_templates_waha_delay_check;

ALTER TABLE public.broadcast_templates_waha
  ADD CONSTRAINT broadcast_templates_waha_delay_check
  CHECK (
    min_delay_seconds >= 5
    AND max_delay_seconds >= min_delay_seconds
    AND max_delay_seconds <= 86400
  );

COMMENT ON CONSTRAINT broadcast_campaigns_waha_delay_check
  ON public.broadcast_campaigns_waha IS
  'Intervalo de envio: mínimo 5s, máximo 86400s (24h), alinhado ao Disparador 2 Evolution.';

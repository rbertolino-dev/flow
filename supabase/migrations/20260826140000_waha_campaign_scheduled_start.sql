-- Horário do primeiro envio da campanha WAHA (próximo minuto ao criar/iniciar).
ALTER TABLE public.broadcast_campaigns_waha
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ;

COMMENT ON COLUMN public.broadcast_campaigns_waha.scheduled_start_at IS
  'Horário do primeiro envio. O intervalo min/max vale entre mensagens, não na espera inicial.';

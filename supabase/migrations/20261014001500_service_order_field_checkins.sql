-- Check-ins GPS da operação de campo (técnico no celular)
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS field_checkins jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.service_orders.field_checkins IS
  'Array de check-ins GPS: { at, lat, lng, accuracy?, event }';

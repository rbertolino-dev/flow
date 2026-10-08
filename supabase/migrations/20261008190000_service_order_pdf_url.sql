-- URL pública do PDF da ordem de serviço (envio WhatsApp / reuso)
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS pdf_url TEXT;

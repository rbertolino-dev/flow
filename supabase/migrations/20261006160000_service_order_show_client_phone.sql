-- Telefone do cliente fica oculto para quem executa, salvo se a ordem permitir.

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS show_client_phone BOOLEAN NOT NULL DEFAULT false;

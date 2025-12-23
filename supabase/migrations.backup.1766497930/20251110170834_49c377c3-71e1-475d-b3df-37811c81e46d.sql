-- Adicionar coluna personalized_message à tabela broadcast_queue
ALTER TABLE public.broadcast_queue
ADD COLUMN personalized_message text;
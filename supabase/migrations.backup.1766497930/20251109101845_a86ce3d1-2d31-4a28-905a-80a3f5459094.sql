-- Habilitar REPLICA IDENTITY FULL para call_queue (necessário para realtime completo)
ALTER TABLE public.call_queue REPLICA IDENTITY FULL;
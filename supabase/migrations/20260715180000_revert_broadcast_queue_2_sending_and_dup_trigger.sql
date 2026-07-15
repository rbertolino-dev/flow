-- Reverte a migration 20260714210000: status 'sending' viola valid_queue_status_2
-- (CHECK só permite pending, scheduled, sent, failed, cancelled).
-- Remove o trigger/função que referenciam 'sending' e bloqueavam INSERT/UPDATE.

DROP TRIGGER IF EXISTS trg_broadcast_queue_2_block_rotate_phone_dup ON public.broadcast_queue_2;
DROP FUNCTION IF EXISTS public.broadcast_queue_2_block_rotate_phone_dup();

-- ==========================================
-- Migration: Adicionar status 'cancelled' à tabela broadcast_queue
-- ==========================================
-- Problema: Constraint não permite status 'cancelled'
-- Solução: Adicionar 'cancelled' aos status válidos
-- ==========================================

-- Remover constraint antiga
ALTER TABLE public.broadcast_queue 
DROP CONSTRAINT IF EXISTS valid_queue_status;

ALTER TABLE public.broadcast_queue 
DROP CONSTRAINT IF EXISTS broadcast_queue_status_check;

-- Adicionar constraint com status 'cancelled'
ALTER TABLE public.broadcast_queue 
ADD CONSTRAINT broadcast_queue_status_check 
CHECK (status IN ('pending', 'scheduled', 'sent', 'failed', 'cancelled'));

-- Comentário na constraint
COMMENT ON CONSTRAINT broadcast_queue_status_check ON public.broadcast_queue IS 
  'Status válidos: pending, scheduled, sent, failed, cancelled';


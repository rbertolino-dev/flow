-- Add instance_id column to broadcast_queue for multi-instance rotation
ALTER TABLE public.broadcast_queue 
ADD COLUMN instance_id UUID REFERENCES public.evolution_config(id);

-- Add index for better query performance
DROP INDEX IF EXISTS idx_broadcast_queue_instance_id CASCADE;
CREATE INDEX idx_broadcast_queue_instance_id ON
CREATE INDEX idx_broadcast_queue_instance_id ON public.broadcast_queue(instance_id);

-- Backfill existing records with instance_id from their campaign
UPDATE public.broadcast_queue bq
SET instance_id = bc.instance_id
FROM public.broadcast_campaigns bc
WHERE bq.campaign_id = bc.id
  AND bq.instance_id IS NULL
  AND bc.instance_id IS NOT NULL;
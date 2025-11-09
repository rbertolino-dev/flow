-- Adicionar status 'cancelled' à constraint da tabela broadcast_queue
ALTER TABLE broadcast_queue DROP CONSTRAINT IF EXISTS valid_queue_status;

ALTER TABLE broadcast_queue ADD CONSTRAINT valid_queue_status 
CHECK (status IN ('pending', 'scheduled', 'sent', 'failed', 'cancelled'));
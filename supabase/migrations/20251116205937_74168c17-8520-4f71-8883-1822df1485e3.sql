-- Add sync_path and sync_method to evolution_config to support flexible endpoints
ALTER TABLE public.evolution_config
  ADD COLUMN IF NOT EXISTS sync_path TEXT DEFAULT '/viewpool/sync-agent',
  ADD COLUMN IF NOT EXISTS sync_method TEXT DEFAULT 'POST';

-- Optional: constrain sync_method to allowed values using a CHECK-like trigger would be better,
-- but for simplicity we keep free-form and validate in edge function.

-- Backfill existing rows to defaults (covers rows created before default applied)
UPDATE public.evolution_config
SET sync_path = COALESCE(sync_path, '/viewpool/sync-agent'),
    sync_method = COALESCE(sync_method, 'POST');
-- Create evolution_logs table for debugging and monitoring
CREATE TABLE IF NOT EXISTS public.evolution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  instance TEXT,
  event TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.evolution_logs ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_evolution_logs_user_created ON public.evolution_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_logs_event ON public.evolution_logs (event);

-- Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evolution_logs' AND policyname = 'Users can view their own evolution logs'
  ) THEN
    CREATE POLICY "Users can view their own evolution logs"
    ON public.evolution_logs
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evolution_logs' AND policyname = 'Users can insert their own evolution logs'
  ) THEN
    CREATE POLICY "Users can insert their own evolution logs"
    ON public.evolution_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
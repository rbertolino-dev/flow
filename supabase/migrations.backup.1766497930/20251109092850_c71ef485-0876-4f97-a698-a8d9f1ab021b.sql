-- Add missing updated_at to call_queue and a trigger to maintain it
ALTER TABLE public.call_queue
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Create trigger to auto-update updated_at on updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_call_queue_updated_at'
  ) THEN
    CREATE TRIGGER update_call_queue_updated_at
    BEFORE UPDATE ON public.call_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
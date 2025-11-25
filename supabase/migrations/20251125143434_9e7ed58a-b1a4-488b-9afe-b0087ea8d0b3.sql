-- Drop trigger existente se houver
DROP TRIGGER IF EXISTS update_scheduled_messages_updated_at ON public.scheduled_messages;

-- Criar ou substituir função do trigger
CREATE OR REPLACE FUNCTION public.update_scheduled_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
CREATE TRIGGER update_scheduled_messages_updated_at
  BEFORE UPDATE ON public.scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_scheduled_messages_updated_at();
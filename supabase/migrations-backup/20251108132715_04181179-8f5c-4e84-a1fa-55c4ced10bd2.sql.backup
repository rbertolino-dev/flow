-- Ensure function exists (idempotent)
CREATE OR REPLACE FUNCTION public.set_scheduled_message_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Fill organization_id from lead if null
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.leads
    WHERE id = NEW.lead_id;
  END IF;

  -- Ensure user_id defaults to current user when possible
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to set organization_id/user_id on insert
DROP TRIGGER IF EXISTS trg_set_scheduled_message_organization ON public.scheduled_messages;
CREATE TRIGGER trg_set_scheduled_message_organization
BEFORE INSERT ON public.scheduled_messages
FOR EACH ROW
EXECUTE FUNCTION public.set_scheduled_message_organization();
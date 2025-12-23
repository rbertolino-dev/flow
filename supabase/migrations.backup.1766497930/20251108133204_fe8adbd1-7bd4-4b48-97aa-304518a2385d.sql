-- Harden trigger: ensure organization_id is derived and not null
CREATE OR REPLACE FUNCTION public.set_scheduled_message_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  -- Fetch organization of the target lead
  SELECT l.organization_id INTO v_org
  FROM public.leads l
  WHERE l.id = NEW.lead_id
  LIMIT 1;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Lead % não possui organização ou não existe', NEW.lead_id;
  END IF;

  -- Set org from lead when missing
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := v_org;
  END IF;

  -- Ensure user_id when missing
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

-- Use SECURITY DEFINER function for membership check to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.can_schedule_message_for_lead(_lead_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    EXISTS (
      SELECT 1
      FROM public.leads l
      JOIN public.organization_members om ON om.organization_id = l.organization_id
      WHERE l.id = _lead_id
        AND om.user_id = _user_id
    )
    OR public.has_role(_user_id, 'admin'::app_role)
    OR public.is_pubdigital_user(_user_id)
  );
$$;

-- Replace INSERT policy to rely on the function
DROP POLICY IF EXISTS "Users can create scheduled messages for leads where user is a member" ON public.scheduled_messages;
CREATE POLICY "Users can create scheduled messages (membership or admin)"
ON public.scheduled_messages
FOR INSERT
WITH CHECK (public.can_schedule_message_for_lead(lead_id, auth.uid()));
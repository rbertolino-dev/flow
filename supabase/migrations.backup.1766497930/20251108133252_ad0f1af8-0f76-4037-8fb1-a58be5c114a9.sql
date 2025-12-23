-- Drop existing policy if present
DROP POLICY IF EXISTS "Users can create scheduled messages for leads where user is a member" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can create scheduled messages (membership or admin)" ON public.scheduled_messages;

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

-- Create INSERT policy using the SECURITY DEFINER function
CREATE POLICY "Users can create scheduled messages (membership or admin)"
ON public.scheduled_messages
FOR INSERT
WITH CHECK (public.can_schedule_message_for_lead(lead_id, auth.uid()));
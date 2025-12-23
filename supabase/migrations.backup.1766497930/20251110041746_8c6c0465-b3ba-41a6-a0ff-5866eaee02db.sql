-- Update RLS on whatsapp_messages to allow members of an organization (not only the first org)
-- Ensure RLS is enabled (it already is, but safe to include)
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Drop restrictive policies
DROP POLICY IF EXISTS "Users can view organization messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users can update organization messages" ON public.whatsapp_messages;

-- Recreate policies using membership check, keeping admin/pubsup overrides
CREATE POLICY "Users can view org messages (membership or admin)"
ON public.whatsapp_messages
FOR SELECT
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can update org messages (membership or admin)"
ON public.whatsapp_messages
FOR UPDATE
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
)
WITH CHECK (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

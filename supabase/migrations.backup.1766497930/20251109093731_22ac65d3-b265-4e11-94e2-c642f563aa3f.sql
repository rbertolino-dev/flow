-- Relax update policies to let any org member complete calls
-- Drop restrictive update policies
DROP POLICY IF EXISTS "Call queue: members can update own or admin" ON public.call_queue;
DROP POLICY IF EXISTS "Users can update organization call queue" ON public.call_queue;

-- Create a single permissive update policy for authenticated org members or admins
CREATE POLICY "Org members can update call queue"
ON public.call_queue
FOR UPDATE
TO authenticated
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
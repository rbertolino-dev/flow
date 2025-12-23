-- Update RLS policy for call_queue_history to allow inserts with organization_id
DROP POLICY IF EXISTS "Users can insert organization call queue history" ON public.call_queue_history;

CREATE POLICY "Users can insert organization call queue history" 
ON public.call_queue_history 
FOR INSERT 
WITH CHECK (
  (organization_id = get_user_organization(auth.uid())) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR is_pubdigital_user(auth.uid())
);
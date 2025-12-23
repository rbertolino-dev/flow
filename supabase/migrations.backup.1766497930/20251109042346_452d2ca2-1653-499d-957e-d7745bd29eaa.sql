-- Fix multi-organization RLS for call queue tables and remove broad pubdigital visibility
-- This migration updates policies so users can act in ANY organization they belong to,
-- and removes the special-case global visibility for pubdigital members on these tables.

begin;

-- CALL_QUEUE -----------------------------------------------------------
-- Remove broad super admin visibility that included is_pubdigital_user
DROP POLICY IF EXISTS "Super admins can view all call_queue" ON public.call_queue;
CREATE POLICY "Super admins can view all call_queue"
ON public.call_queue
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- View
DROP POLICY IF EXISTS "Users can view organization call queue" ON public.call_queue;
CREATE POLICY "Users can view organization call queue"
ON public.call_queue
FOR SELECT
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Insert
DROP POLICY IF EXISTS "Users can insert organization call queue" ON public.call_queue;
CREATE POLICY "Users can insert organization call queue"
ON public.call_queue
FOR INSERT
WITH CHECK (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Update
DROP POLICY IF EXISTS "Users can update organization call queue" ON public.call_queue;
CREATE POLICY "Users can update organization call queue"
ON public.call_queue
FOR UPDATE
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Delete
DROP POLICY IF EXISTS "Users can delete organization call queue" ON public.call_queue;
CREATE POLICY "Users can delete organization call queue"
ON public.call_queue
FOR DELETE
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- CALL_QUEUE_HISTORY --------------------------------------------------
-- Remove broad super admin visibility that included is_pubdigital_user
DROP POLICY IF EXISTS "Super admins can view all call_queue_history" ON public.call_queue_history;
CREATE POLICY "Super admins can view all call_queue_history"
ON public.call_queue_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- View
DROP POLICY IF EXISTS "Users can view organization call queue history" ON public.call_queue_history;
CREATE POLICY "Users can view organization call queue history"
ON public.call_queue_history
FOR SELECT
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Insert
DROP POLICY IF EXISTS "Users can insert organization call queue history" ON public.call_queue_history;
CREATE POLICY "Users can insert organization call queue history"
ON public.call_queue_history
FOR INSERT
WITH CHECK (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Delete
DROP POLICY IF EXISTS "Users can delete organization call queue history" ON public.call_queue_history;
CREATE POLICY "Users can delete organization call queue history"
ON public.call_queue_history
FOR DELETE
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

commit;
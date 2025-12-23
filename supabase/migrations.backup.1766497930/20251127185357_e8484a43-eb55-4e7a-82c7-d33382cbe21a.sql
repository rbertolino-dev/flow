
-- Corrigir política RLS de INSERT para whatsapp_workflow_groups
DROP POLICY IF EXISTS "Users can insert organization workflow groups" ON public.whatsapp_workflow_groups;

CREATE POLICY "Users can insert organization workflow groups" 
ON public.whatsapp_workflow_groups
FOR INSERT
TO public
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

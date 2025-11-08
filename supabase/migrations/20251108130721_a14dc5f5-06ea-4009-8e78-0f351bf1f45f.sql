-- Tornar a política de INSERT compatível com usuários que pertencem a múltiplas organizações
DROP POLICY IF EXISTS "Users can create scheduled messages for leads in their org" ON public.scheduled_messages;

CREATE POLICY "Users can create scheduled messages for leads where user is a member"
ON public.scheduled_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.leads l
    JOIN public.organization_members om ON om.organization_id = l.organization_id
    WHERE l.id = lead_id
      AND om.user_id = auth.uid()
  )
);
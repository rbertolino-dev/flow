
-- Drop old restrictive policies
DROP POLICY IF EXISTS "Users can add tags to their leads" ON public.lead_tags;
DROP POLICY IF EXISTS "Users can remove tags from their leads" ON public.lead_tags;
DROP POLICY IF EXISTS "Users can view tags on their leads" ON public.lead_tags;

-- Create new organization-scoped policies for lead_tags
CREATE POLICY "Users can add tags to organization leads"
ON public.lead_tags
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.leads l
    JOIN public.organization_members om ON om.organization_id = l.organization_id
    WHERE l.id = lead_tags.lead_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can remove tags from organization leads"
ON public.lead_tags
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.leads l
    JOIN public.organization_members om ON om.organization_id = l.organization_id
    WHERE l.id = lead_tags.lead_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view tags on organization leads"
ON public.lead_tags
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.leads l
    JOIN public.organization_members om ON om.organization_id = l.organization_id
    WHERE l.id = lead_tags.lead_id
      AND om.user_id = auth.uid()
  )
);

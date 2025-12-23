-- Update RLS policies on pipeline_stages to allow members of any of their organizations
-- Drop existing org-equals policies
DROP POLICY IF EXISTS "Users can create organization pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can delete organization pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can update organization pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can view organization pipeline stages" ON public.pipeline_stages;

-- Recreate policies using membership check
CREATE POLICY "Users can create organization pipeline stages"
ON public.pipeline_stages
FOR INSERT
WITH CHECK (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can delete organization pipeline stages"
ON public.pipeline_stages
FOR DELETE
USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update organization pipeline stages"
ON public.pipeline_stages
FOR UPDATE
USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can view organization pipeline stages"
ON public.pipeline_stages
FOR SELECT
USING (public.user_belongs_to_org(auth.uid(), organization_id));
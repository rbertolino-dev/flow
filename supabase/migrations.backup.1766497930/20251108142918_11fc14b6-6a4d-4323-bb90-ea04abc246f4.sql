-- Fix recursive SELECT policy on organization_members causing infinite recursion
-- 1) Drop the self-referential policy
DROP POLICY IF EXISTS "Users can view members of their organization" ON public.organization_members;

-- 2) Recreate using SECURITY DEFINER helper (avoids recursion)
CREATE POLICY "Users can view members of their organization"
ON public.organization_members
FOR SELECT
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
);

-- Keep existing admin-wide visibility policy as-is
-- No change to INSERT/UPDATE/DELETE policies (they already use definer functions)

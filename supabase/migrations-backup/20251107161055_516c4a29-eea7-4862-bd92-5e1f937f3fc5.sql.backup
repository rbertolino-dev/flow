-- 1) Create function to check if user is owner/admin of an org (avoids policy recursion)
CREATE OR REPLACE FUNCTION public.user_is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role IN ('owner', 'admin')
  );
$$;

-- 2) Replace recursive policy on organization_members with function-based policies
DROP POLICY IF EXISTS "Organization owners and admins can manage members" ON public.organization_members;

-- Insert
CREATE POLICY "Org admins manage members - insert"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_pubdigital_user(auth.uid())
);

-- Update
CREATE POLICY "Org admins manage members - update"
ON public.organization_members
FOR UPDATE
TO authenticated
USING (
  public.user_is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_pubdigital_user(auth.uid())
)
WITH CHECK (
  public.user_is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_pubdigital_user(auth.uid())
);

-- Delete
CREATE POLICY "Org admins manage members - delete"
ON public.organization_members
FOR DELETE
TO authenticated
USING (
  public.user_is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_pubdigital_user(auth.uid())
);

-- 3) Function to create organization and set owner in one atomic call (avoids RLS issues)
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(org_name text, owner_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  INSERT INTO public.organizations(name)
  VALUES (org_name)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members(organization_id, user_id, role)
  VALUES (new_org_id, COALESCE(owner_user_id, auth.uid()), 'owner');

  RETURN new_org_id;
END;
$$;
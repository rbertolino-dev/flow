-- Fix duplicate pipeline stage errors when adding members to organizations
-- 1) Drop old per-user unique constraint on pipeline stages
ALTER TABLE public.pipeline_stages
  DROP CONSTRAINT IF EXISTS pipeline_stages_user_id_name_key;

-- 2) Enforce case-insensitive uniqueness of stage names within an organization
--    (allows same user across multiple orgs without conflicts)
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_stages_org_lower_name_unique
  ON public.pipeline_stages (organization_id, lower(name));

-- 3) Create or replace robust function to create default stages once per org
CREATE OR REPLACE FUNCTION public.maybe_create_pipeline_stages_for_org()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  stages_exist boolean;
  target_user uuid;
BEGIN
  -- If org already has any stages, do nothing
  SELECT EXISTS (
    SELECT 1 FROM public.pipeline_stages ps
    WHERE ps.organization_id = NEW.organization_id
  ) INTO stages_exist;

  IF stages_exist THEN
    RETURN NEW;
  END IF;

  -- Pick an owner/admin for the org; fallback to the new member
  SELECT om.user_id
  INTO target_user
  FROM public.organization_members om
  WHERE om.organization_id = NEW.organization_id
    AND (om.role = 'owner' OR om.role = 'admin')
  ORDER BY CASE WHEN om.role = 'owner' THEN 1 ELSE 2 END
  LIMIT 1;

  IF target_user IS NULL THEN
    target_user := NEW.user_id;
  END IF;

  -- Insert default stages (idempotent via unique index + DO NOTHING)
  INSERT INTO public.pipeline_stages (id, name, color, position, organization_id, user_id)
  VALUES
    (gen_random_uuid(), 'Novo Lead', '#6366f1', 0, NEW.organization_id, target_user),
    (gen_random_uuid(), 'Em Negociação', '#22c55e', 1, NEW.organization_id, target_user),
    (gen_random_uuid(), 'Aguardando Retorno', '#f59e0b', 2, NEW.organization_id, target_user),
    (gen_random_uuid(), 'Fechado', '#6b7280', 3, NEW.organization_id, target_user)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- 4) Ensure only the correct trigger exists and is wired to the safe function
DROP TRIGGER IF EXISTS create_pipeline_stages_for_new_org ON public.organization_members;
DROP TRIGGER IF EXISTS create_pipeline_stages_on_first_member ON public.organization_members;
DROP TRIGGER IF EXISTS on_organization_member_added ON public.organization_members;

CREATE TRIGGER create_pipeline_stages_for_new_org
AFTER INSERT ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.maybe_create_pipeline_stages_for_org();
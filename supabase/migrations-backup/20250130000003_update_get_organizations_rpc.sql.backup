-- ============================================
-- MIGRAÇÃO: Atualizar função RPC para incluir plan_id
-- ============================================

-- Atualizar função para incluir plan_id
CREATE OR REPLACE FUNCTION public.get_all_organizations_with_members()
RETURNS TABLE (
  org_id uuid,
  org_name text,
  org_created_at timestamptz,
  org_plan_id uuid,
  member_user_id uuid,
  member_role text,
  member_created_at timestamptz,
  member_email text,
  member_full_name text,
  member_roles jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    o.id as org_id,
    o.name as org_name,
    o.created_at as org_created_at,
    o.plan_id as org_plan_id,
    om.user_id as member_user_id,
    om.role as member_role,
    om.created_at as member_created_at,
    p.email as member_email,
    p.full_name as member_full_name,
    (
      SELECT jsonb_agg(jsonb_build_object('role', ur.role))
      FROM user_roles ur
      WHERE ur.user_id = om.user_id
    ) as member_roles
  FROM organizations o
  LEFT JOIN organization_members om ON om.organization_id = o.id
  LEFT JOIN profiles p ON p.id = om.user_id
  ORDER BY o.created_at DESC;
$$;




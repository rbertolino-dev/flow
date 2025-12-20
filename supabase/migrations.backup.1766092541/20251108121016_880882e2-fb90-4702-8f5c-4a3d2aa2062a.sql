-- ============================================
-- CORREÇÃO DO SISTEMA MULTI-EMPRESA E PERMISSÕES
-- ============================================

-- 1. Adicionar organization_id na tabela activities
ALTER TABLE public.activities 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Popular organization_id das activities baseado nos leads
UPDATE public.activities a
SET organization_id = l.organization_id
FROM public.leads l
WHERE a.lead_id = l.id AND a.organization_id IS NULL;

-- 2. Adicionar organization_id na tabela user_permissions (permissões por organização)
ALTER TABLE public.user_permissions 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Criar índices para performance
DROP INDEX IF EXISTS idx_activities_organization_id CASCADE;
CREATE INDEX idx_activities_organization_id ON
CREATE INDEX idx_activities_organization_id ON public.activities(organization_id);
DROP INDEX IF EXISTS idx_user_permissions_organization_id CASCADE;
CREATE INDEX idx_user_permissions_organization_id ON
CREATE INDEX idx_user_permissions_organization_id ON public.user_permissions(organization_id);
DROP INDEX IF EXISTS idx_user_permissions_user_org CASCADE;
CREATE INDEX idx_user_permissions_user_org ON
CREATE INDEX idx_user_permissions_user_org ON public.user_permissions(user_id, organization_id);

-- 3. Atualizar constraint de unicidade em user_permissions (user + permission + org)
ALTER TABLE public.user_permissions DROP CONSTRAINT IF EXISTS user_permissions_user_id_permission_key;
ALTER TABLE public.user_permissions 
ADD CONSTRAINT user_permissions_user_permission_org_unique 
UNIQUE (user_id, permission, organization_id);

-- 4. Função para verificar permissões por organização
CREATE OR REPLACE FUNCTION public.has_org_permission(
  _user_id UUID, 
  _permission app_permission,
  _org_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND permission = _permission
      AND (organization_id = _org_id OR organization_id IS NULL) -- NULL = permissão global
  )
$$;

-- 5. Atualizar função get_user_permissions para incluir contexto de organização
CREATE OR REPLACE FUNCTION public.get_user_permissions_for_org(_user_id UUID, _org_id UUID)
RETURNS TABLE(permission app_permission)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT permission
  FROM public.user_permissions
  WHERE user_id = _user_id
    AND (organization_id = _org_id OR organization_id IS NULL)
$$;

-- 6. Atualizar RLS policies de activities para isolamento por organização
DROP POLICY IF EXISTS "Users can insert activities for their leads" ON public.activities;
DROP POLICY IF EXISTS "Users can view activities of their leads" ON public.activities;

CREATE POLICY "Users can insert organization activities"
ON public.activities
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Users can view organization activities"
ON public.activities
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can update organization activities"
ON public.activities
FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR is_pubdigital_user(auth.uid())
);

-- 7. Atualizar RLS policies de user_permissions para permitir gestão por org admins
DROP POLICY IF EXISTS "Admins can manage all user permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admins can view all user permissions" ON public.user_permissions;

-- Super admins podem ver e gerenciar tudo
CREATE POLICY "Super admins can view all permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Super admins can manage all permissions"
ON public.user_permissions
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR is_pubdigital_user(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR is_pubdigital_user(auth.uid())
);

-- Org admins podem gerenciar permissões da sua organização
CREATE POLICY "Org admins can view organization permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (
  user_is_org_admin(auth.uid(), organization_id)
);

CREATE POLICY "Org admins can manage organization permissions"
ON public.user_permissions
FOR ALL
TO authenticated
USING (
  user_is_org_admin(auth.uid(), organization_id)
)
WITH CHECK (
  user_is_org_admin(auth.uid(), organization_id)
);

-- 8. Função helper para verificar se usuário pode gerenciar outro usuário
CREATE OR REPLACE FUNCTION public.can_manage_user(
  _manager_id UUID,
  _target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Super admins podem gerenciar qualquer um
  SELECT (
    has_role(_manager_id, 'admin'::app_role) 
    OR is_pubdigital_user(_manager_id)
    -- OU org admin gerenciando usuário da mesma org
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om1
      JOIN public.organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = _manager_id
        AND om2.user_id = _target_user_id
        AND om1.role IN ('owner', 'admin')
    )
  )
$$;

-- 9. Trigger para auto-popular organization_id em activities
CREATE OR REPLACE FUNCTION public.set_activity_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se organization_id não foi fornecido, pegar do lead
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.leads
    WHERE id = NEW.lead_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_activity_organization_trigger
BEFORE INSERT ON public.activities
FOR EACH ROW
EXECUTE FUNCTION public.set_activity_organization();

-- 10. Comentários para documentação
COMMENT ON COLUMN public.user_permissions.organization_id IS 
'ID da organização. NULL = permissão global (super admin)';

COMMENT ON FUNCTION public.has_org_permission IS 
'Verifica se usuário tem permissão específica em uma organização';

COMMENT ON FUNCTION public.can_manage_user IS 
'Verifica se um usuário (manager) pode gerenciar outro usuário (target)';
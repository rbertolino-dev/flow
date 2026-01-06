-- =====================================================
-- FIX: Corrigir políticas RLS de facebook_configs
-- =====================================================
-- Problema: Erro 406 (Not Acceptable) ao acessar facebook_configs
-- Solução: Simplificar políticas e garantir que is_pubdigital_user funciona

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can view their org facebook config" ON public.facebook_configs;
DROP POLICY IF EXISTS "Users can insert their org facebook config" ON public.facebook_configs;
DROP POLICY IF EXISTS "Users can update their org facebook config" ON public.facebook_configs;
DROP POLICY IF EXISTS "Users can delete their org facebook config" ON public.facebook_configs;
DROP POLICY IF EXISTS "facebook_configs_select_org_members" ON public.facebook_configs;
DROP POLICY IF EXISTS "facebook_configs_insert_org_members" ON public.facebook_configs;
DROP POLICY IF EXISTS "facebook_configs_update_org_members" ON public.facebook_configs;
DROP POLICY IF EXISTS "facebook_configs_delete_org_members" ON public.facebook_configs;
DROP POLICY IF EXISTS "Users can view facebook configs from their organization" ON public.facebook_configs;
DROP POLICY IF EXISTS "Admins can insert facebook configs" ON public.facebook_configs;
DROP POLICY IF EXISTS "Admins can update facebook configs" ON public.facebook_configs;
DROP POLICY IF EXISTS "Admins can delete facebook configs" ON public.facebook_configs;

-- Política para SELECT: Usuários podem ver configs da própria organização
CREATE POLICY "facebook_configs_select_org_members"
  ON public.facebook_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = facebook_configs.organization_id
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Política para INSERT: Membros da organização podem inserir
CREATE POLICY "facebook_configs_insert_org_members"
  ON public.facebook_configs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = facebook_configs.organization_id
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Política para UPDATE: Membros da organização podem atualizar
CREATE POLICY "facebook_configs_update_org_members"
  ON public.facebook_configs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = facebook_configs.organization_id
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = facebook_configs.organization_id
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Política para DELETE: Membros da organização podem deletar
CREATE POLICY "facebook_configs_delete_org_members"
  ON public.facebook_configs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = facebook_configs.organization_id
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Comentário
COMMENT ON TABLE public.facebook_configs IS 'Configurações de integração Facebook/Instagram. Políticas RLS permitem acesso por organização.';


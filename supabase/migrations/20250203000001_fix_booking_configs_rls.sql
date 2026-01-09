-- Migration: Correção de RLS para organization_booking_configs
-- Corrige erro 406 (Not Acceptable) ao fazer SELECT na tabela
-- Data: 2025-02-03

-- 1. Garantir que função user_is_org_admin existe (se não existir)
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

-- 2. Remover políticas antigas
DROP POLICY IF EXISTS "Organization booking config: members can select" ON public.organization_booking_configs;
DROP POLICY IF EXISTS "Organization booking config: public can select by slug" ON public.organization_booking_configs;
DROP POLICY IF EXISTS "Organization booking config: admins can manage" ON public.organization_booking_configs;

-- 3. Criar política de SELECT para membros autenticados (CORRIGIDA)
-- Especifica TO authenticated explicitamente e verifica membro de forma mais robusta
CREATE POLICY "Organization booking config: members can select"
  ON public.organization_booking_configs
  FOR SELECT
  TO authenticated
  USING (
    -- Usuário é membro da organização (qualquer role)
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_booking_configs.organization_id
        AND om.user_id = auth.uid()
    )
    -- OU é admin/owner da organização
    OR public.user_is_org_admin(auth.uid(), organization_booking_configs.organization_id)
  );

-- 4. Política pública para acesso sem autenticação (para link público)
-- Permite SELECT quando is_active = true (para página pública de agendamento)
CREATE POLICY "Organization booking config: public can select by slug"
  ON public.organization_booking_configs
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- 5. Política para admins gerenciarem (INSERT, UPDATE, DELETE)
CREATE POLICY "Organization booking config: admins can manage"
  ON public.organization_booking_configs
  FOR ALL
  TO authenticated
  USING (
    public.user_is_org_admin(auth.uid(), organization_booking_configs.organization_id)
  )
  WITH CHECK (
    public.user_is_org_admin(auth.uid(), organization_booking_configs.organization_id)
  );

-- Comentários
COMMENT ON POLICY "Organization booking config: members can select" ON public.organization_booking_configs IS 
  'Permite que membros autenticados da organização vejam a configuração de agendamento';
COMMENT ON POLICY "Organization booking config: public can select by slug" ON public.organization_booking_configs IS 
  'Permite acesso público (sem autenticação) para buscar configuração ativa por slug';
COMMENT ON POLICY "Organization booking config: admins can manage" ON public.organization_booking_configs IS 
  'Permite que admins/owners da organização gerenciem (INSERT/UPDATE/DELETE) a configuração';




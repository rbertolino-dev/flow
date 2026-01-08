-- Script de Correção: Erro 406 ao acessar organization_booking_configs
-- Execute este script no Supabase SQL Editor para corrigir o erro
-- Data: 2025-02-03

-- ==========================================
-- 1. GARANTIR QUE FUNÇÃO user_is_org_admin EXISTE
-- ==========================================
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

-- ==========================================
-- 2. REMOVER POLÍTICAS ANTIGAS
-- ==========================================
DROP POLICY IF EXISTS "Organization booking config: members can select" ON public.organization_booking_configs;
DROP POLICY IF EXISTS "Organization booking config: public can select by slug" ON public.organization_booking_configs;
DROP POLICY IF EXISTS "Organization booking config: admins can manage" ON public.organization_booking_configs;

-- ==========================================
-- 3. CRIAR POLÍTICA DE SELECT PARA MEMBROS AUTENTICADOS (CORRIGIDA)
-- ==========================================
-- PROBLEMA ORIGINAL: Política não especificava TO authenticated
-- SOLUÇÃO: Adicionar TO authenticated explicitamente
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

-- ==========================================
-- 4. POLÍTICA PÚBLICA PARA ACESSO SEM AUTENTICAÇÃO
-- ==========================================
-- Permite SELECT quando is_active = true (para página pública de agendamento)
CREATE POLICY "Organization booking config: public can select by slug"
  ON public.organization_booking_configs
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- ==========================================
-- 5. POLÍTICA PARA ADMINS GERENCIAREM (INSERT, UPDATE, DELETE)
-- ==========================================
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

-- ==========================================
-- 6. VERIFICAÇÃO (OPCIONAL - para testar)
-- ==========================================
-- Descomente as linhas abaixo para verificar se as políticas foram criadas:
-- SELECT 
--   schemaname,
--   tablename,
--   policyname,
--   permissive,
--   roles,
--   cmd
-- FROM pg_policies
-- WHERE tablename = 'organization_booking_configs'
-- ORDER BY policyname;

-- ==========================================
-- FIM DO SCRIPT
-- ==========================================
-- Após executar este script, o erro 406 deve ser resolvido.
-- Teste acessando a página de configuração de agendamento novamente.


-- ============================================
-- Migration: Garantir que RLS permita INSERT em organization_limits
-- ============================================
-- A política "FOR ALL" pode não funcionar corretamente para INSERT em alguns casos
-- Vamos criar políticas explícitas para INSERT, UPDATE e DELETE

-- Remover política antiga se existir (vamos recriar mais específica)
DROP POLICY IF EXISTS "Super admins can manage all organization limits" ON public.organization_limits;

-- Política explícita para INSERT (super admins)
CREATE POLICY "Super admins can insert organization limits"
  ON public.organization_limits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Política explícita para UPDATE (super admins)
CREATE POLICY "Super admins can update organization limits"
  ON public.organization_limits
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR public.is_pubdigital_user(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Política explícita para DELETE (super admins)
CREATE POLICY "Super admins can delete organization limits"
  ON public.organization_limits
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Verificar e corrigir políticas de organization_evolution_providers também
-- Remover política antiga se existir
DROP POLICY IF EXISTS "Super admins can manage all organization evolution providers" ON public.organization_evolution_providers;

-- Política explícita para INSERT (super admins)
CREATE POLICY "Super admins can insert organization evolution providers"
  ON public.organization_evolution_providers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Política explícita para UPDATE (super admins)
CREATE POLICY "Super admins can update organization evolution providers"
  ON public.organization_evolution_providers
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR public.is_pubdigital_user(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Política explícita para DELETE (super admins)
CREATE POLICY "Super admins can delete organization evolution providers"
  ON public.organization_evolution_providers
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Comentários
COMMENT ON POLICY "Super admins can insert organization limits" ON public.organization_limits IS 'Permite que super admins criem novos registros de limites';
COMMENT ON POLICY "Super admins can update organization limits" ON public.organization_limits IS 'Permite que super admins atualizem registros de limites';
COMMENT ON POLICY "Super admins can delete organization limits" ON public.organization_limits IS 'Permite que super admins deletem registros de limites';


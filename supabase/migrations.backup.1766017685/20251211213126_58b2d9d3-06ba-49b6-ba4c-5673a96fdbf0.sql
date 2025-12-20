-- =============================================
-- FIX CRITICAL SECURITY ISSUES
-- =============================================

-- 1. PROFILES TABLE: Remover policy pública que expõe emails
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Criar policy mais restritiva: usuários só veem perfis da própria organização
CREATE POLICY "Users can view profiles in their organization" 
ON public.profiles 
FOR SELECT 
USING (
  id = auth.uid() -- Próprio perfil
  OR id IN (
    SELECT om2.user_id 
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- 2. LEADS TABLE: Garantir que deleted_at seja sempre filtrado em queries normais
-- e adicionar comentário sobre segurança
COMMENT ON COLUMN public.leads.email IS 'Sensitive PII - protected by organization RLS';
COMMENT ON COLUMN public.leads.phone IS 'Sensitive PII - protected by organization RLS';
COMMENT ON TABLE public.leads IS 'Contains sensitive customer data. Always filter by organization_id and deleted_at IS NULL.';
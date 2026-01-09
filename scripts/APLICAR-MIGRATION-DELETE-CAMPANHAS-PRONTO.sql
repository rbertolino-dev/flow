-- =====================================================
-- APLICAR ESTE SQL NO SUPABASE SQL EDITOR
-- =====================================================
-- Este SQL permite que usuários excluam campanhas canceladas
-- Execute este arquivo no Supabase SQL Editor
-- =====================================================

-- Verificar se RLS está habilitado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename = 'broadcast_campaigns'
      AND rowsecurity = true
  ) THEN
    ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Remover política DELETE antiga se existir
DROP POLICY IF EXISTS "Users can delete their org broadcast campaigns" ON public.broadcast_campaigns;
DROP POLICY IF EXISTS "broadcast_campaigns_delete_org_members" ON public.broadcast_campaigns;
DROP POLICY IF EXISTS "Org members can delete broadcast campaigns" ON public.broadcast_campaigns;

-- Política para DELETE: Membros da organização podem deletar campanhas da sua organização
CREATE POLICY "broadcast_campaigns_delete_org_members"
  ON public.broadcast_campaigns FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = broadcast_campaigns.organization_id
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Comentário
COMMENT ON POLICY "broadcast_campaigns_delete_org_members" ON public.broadcast_campaigns IS 
  'Permite que membros da organização deletem campanhas da sua organização. Super admins podem deletar qualquer campanha.';

-- Verificar se política foi criada
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'broadcast_campaigns'
  AND policyname = 'broadcast_campaigns_delete_org_members';


  
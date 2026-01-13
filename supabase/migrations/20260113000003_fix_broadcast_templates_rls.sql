-- =====================================================
-- FIX: Garantir políticas RLS corretas para broadcast_campaign_templates
-- =====================================================
-- Problema: UPDATE pode estar sendo bloqueado por falta de políticas RLS
-- Solução: Criar/atualizar políticas RLS para permitir UPDATE

-- Verificar se RLS está habilitado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename = 'broadcast_campaign_templates'
      AND rowsecurity = true
  ) THEN
    ALTER TABLE public.broadcast_campaign_templates ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users can update their own templates" ON public.broadcast_campaign_templates;
DROP POLICY IF EXISTS "broadcast_templates_update_org_members" ON public.broadcast_campaign_templates;
DROP POLICY IF EXISTS "Org members can update broadcast templates" ON public.broadcast_campaign_templates;

-- Política para UPDATE: Membros da organização podem atualizar templates da sua organização
CREATE POLICY "broadcast_templates_update_org_members"
  ON public.broadcast_campaign_templates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = broadcast_campaign_templates.organization_id
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = broadcast_campaign_templates.organization_id
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Garantir que há políticas para SELECT, INSERT e DELETE também
-- SELECT
DROP POLICY IF EXISTS "broadcast_templates_select_org_members" ON public.broadcast_campaign_templates;
CREATE POLICY "broadcast_templates_select_org_members"
  ON public.broadcast_campaign_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = broadcast_campaign_templates.organization_id
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- INSERT
DROP POLICY IF EXISTS "broadcast_templates_insert_org_members" ON public.broadcast_campaign_templates;
CREATE POLICY "broadcast_templates_insert_org_members"
  ON public.broadcast_campaign_templates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = broadcast_campaign_templates.organization_id
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- DELETE
DROP POLICY IF EXISTS "broadcast_templates_delete_org_members" ON public.broadcast_campaign_templates;
CREATE POLICY "broadcast_templates_delete_org_members"
  ON public.broadcast_campaign_templates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = broadcast_campaign_templates.organization_id
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Comentários
COMMENT ON POLICY "broadcast_templates_update_org_members" ON public.broadcast_campaign_templates IS 
  'Permite que membros da organização atualizem templates da sua organização. Super admins podem atualizar qualquer template.';

COMMENT ON POLICY "broadcast_templates_select_org_members" ON public.broadcast_campaign_templates IS 
  'Permite que membros da organização vejam templates da sua organização. Super admins podem ver qualquer template.';

COMMENT ON POLICY "broadcast_templates_insert_org_members" ON public.broadcast_campaign_templates IS 
  'Permite que membros da organização criem templates na sua organização. Super admins podem criar templates em qualquer organização.';

COMMENT ON POLICY "broadcast_templates_delete_org_members" ON public.broadcast_campaign_templates IS 
  'Permite que membros da organização deletem templates da sua organização. Super admins podem deletar qualquer template.';

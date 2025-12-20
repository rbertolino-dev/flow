-- Corrigir RLS para permitir exclusão por organização (múltiplas orgs)
DROP POLICY IF EXISTS "Users can delete organization config" ON public.evolution_config;

CREATE POLICY "Users can delete organization config"
ON public.evolution_config
FOR DELETE
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);
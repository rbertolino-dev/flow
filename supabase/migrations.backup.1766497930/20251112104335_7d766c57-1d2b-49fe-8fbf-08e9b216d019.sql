-- Corrigir políticas RLS de broadcast_campaigns para suportar múltiplas organizações

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can create organization campaigns" ON public.broadcast_campaigns;
DROP POLICY IF EXISTS "Users can delete organization campaigns" ON public.broadcast_campaigns;
DROP POLICY IF EXISTS "Users can update organization campaigns" ON public.broadcast_campaigns;
DROP POLICY IF EXISTS "Users can view organization campaigns" ON public.broadcast_campaigns;

-- Criar políticas corretas usando user_belongs_to_org
CREATE POLICY "Users can create campaigns for their org"
ON public.broadcast_campaigns
FOR INSERT
TO authenticated
WITH CHECK (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can view campaigns from their org"
ON public.broadcast_campaigns
FOR SELECT
TO authenticated
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can update campaigns from their org"
ON public.broadcast_campaigns
FOR UPDATE
TO authenticated
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can delete campaigns from their org"
ON public.broadcast_campaigns
FOR DELETE
TO authenticated
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);
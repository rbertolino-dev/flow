-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Users can view campaign templates from their org" ON public.broadcast_campaign_templates;
DROP POLICY IF EXISTS "Users can create campaign templates for their org" ON public.broadcast_campaign_templates;
DROP POLICY IF EXISTS "Users can update campaign templates from their org" ON public.broadcast_campaign_templates;
DROP POLICY IF EXISTS "Users can delete campaign templates from their org" ON public.broadcast_campaign_templates;

-- Criar políticas RLS corretas para broadcast_campaign_templates
CREATE POLICY "Users can view campaign templates from their org"
ON public.broadcast_campaign_templates
FOR SELECT
TO authenticated
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create campaign templates for their org"
ON public.broadcast_campaign_templates
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can update campaign templates from their org"
ON public.broadcast_campaign_templates
FOR UPDATE
TO authenticated
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can delete campaign templates from their org"
ON public.broadcast_campaign_templates
FOR DELETE
TO authenticated
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);
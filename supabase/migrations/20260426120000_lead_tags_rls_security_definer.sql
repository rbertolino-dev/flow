-- lead_tags: INSERT/SELECT/DELETE falhavam com 403 quando subconsultas em leads/tags
-- eram bloqueadas pela própria RLS dessas tabelas (efeito em cadeia).
-- Helpers SECURITY DEFINER + row_security off validam organization_members de forma confiável.

CREATE OR REPLACE FUNCTION public.lead_tags_user_may_link(p_lead_id uuid, p_tag_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.leads l
      INNER JOIN public.organization_members om
        ON om.organization_id = l.organization_id
       AND om.user_id = auth.uid()
      WHERE l.id = p_lead_id
        AND l.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM public.tags t
      INNER JOIN public.organization_members om
        ON om.organization_id = t.organization_id
       AND om.user_id = auth.uid()
      WHERE t.id = p_tag_id
    );
$$;

COMMENT ON FUNCTION public.lead_tags_user_may_link(uuid, uuid) IS
  'RLS helper (lead_tags): membro da org do lead e da tag; bypass RLS nas tabelas referenciadas.';

CREATE OR REPLACE FUNCTION public.lead_tags_user_may_access_lead(p_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads l
    INNER JOIN public.organization_members om
      ON om.organization_id = l.organization_id
     AND om.user_id = auth.uid()
    WHERE l.id = p_lead_id
      AND l.deleted_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.lead_tags_user_may_access_lead(uuid) IS
  'RLS helper (lead_tags): membro da org do lead; bypass RLS em leads.';

GRANT EXECUTE ON FUNCTION public.lead_tags_user_may_link(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lead_tags_user_may_access_lead(uuid) TO authenticated;

ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert lead_tags for their organization leads" ON public.lead_tags;
CREATE POLICY "Users can insert lead_tags for their organization leads"
ON public.lead_tags
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND public.lead_tags_user_may_link(lead_id, tag_id)
);

DROP POLICY IF EXISTS "Users can view lead_tags of their organization leads" ON public.lead_tags;
CREATE POLICY "Users can view lead_tags of their organization leads"
ON public.lead_tags
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND public.lead_tags_user_may_access_lead(lead_id)
);

DROP POLICY IF EXISTS "Users can delete lead_tags from their organization leads" ON public.lead_tags;
CREATE POLICY "Users can delete lead_tags from their organization leads"
ON public.lead_tags
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND public.lead_tags_user_may_access_lead(lead_id)
);

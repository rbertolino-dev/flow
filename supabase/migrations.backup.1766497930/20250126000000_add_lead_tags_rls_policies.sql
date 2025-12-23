-- Adicionar políticas RLS para lead_tags
-- Permitir que usuários gerenciem etiquetas de leads da sua organização

-- Habilitar RLS se ainda não estiver habilitado
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;

-- Política para SELECT: usuários podem ver lead_tags de leads da sua organização
DROP POLICY IF EXISTS "Users can view lead_tags of their organization leads" ON public.lead_tags;
CREATE POLICY "Users can view lead_tags of their organization leads"
ON public.lead_tags
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_tags.lead_id
    AND l.organization_id = public.get_user_organization(auth.uid())
  )
);

-- Política para INSERT: usuários podem adicionar etiquetas a leads da sua organização
DROP POLICY IF EXISTS "Users can insert lead_tags for their organization leads" ON public.lead_tags;
CREATE POLICY "Users can insert lead_tags for their organization leads"
ON public.lead_tags
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_tags.lead_id
    AND l.organization_id = public.get_user_organization(auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.tags t
    WHERE t.id = lead_tags.tag_id
    AND t.organization_id = public.get_user_organization(auth.uid())
  )
);

-- Política para DELETE: usuários podem remover etiquetas de leads da sua organização
DROP POLICY IF EXISTS "Users can delete lead_tags from their organization leads" ON public.lead_tags;
CREATE POLICY "Users can delete lead_tags from their organization leads"
ON public.lead_tags
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_tags.lead_id
    AND l.organization_id = public.get_user_organization(auth.uid())
  )
);


-- Correção robusta da política RLS de lead_tags
-- Esta versão é mais permissiva e robusta para garantir que funcione

-- Habilitar RLS se ainda não estiver habilitado
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;

-- Remover todas as políticas antigas de INSERT
DROP POLICY IF EXISTS "Users can insert lead_tags for their organization leads" ON public.lead_tags;
DROP POLICY IF EXISTS "lead_tags_insert_policy" ON public.lead_tags;
DROP POLICY IF EXISTS "Users can manage lead_tags" ON public.lead_tags;

-- Criar política mais robusta de INSERT
-- Verifica diretamente via organization_members sem depender de funções
CREATE POLICY "Users can insert lead_tags for their organization leads"
ON public.lead_tags
FOR INSERT
WITH CHECK (
  -- Verificar se usuário está autenticado
  auth.uid() IS NOT NULL
  AND
  -- Verificar se o lead existe e pertence à organização do usuário
  EXISTS (
    SELECT 1 
    FROM public.leads l
    INNER JOIN public.organization_members om ON om.organization_id = l.organization_id
    WHERE l.id = lead_tags.lead_id
      AND om.user_id = auth.uid()
      AND l.deleted_at IS NULL
  )
  AND
  -- Verificar se a tag existe e pertence à organização do usuário
  EXISTS (
    SELECT 1 
    FROM public.tags t
    INNER JOIN public.organization_members om ON om.organization_id = t.organization_id
    WHERE t.id = lead_tags.tag_id
      AND om.user_id = auth.uid()
  )
);

-- Garantir que políticas de SELECT e DELETE também existem
DROP POLICY IF EXISTS "Users can view lead_tags of their organization leads" ON public.lead_tags;
CREATE POLICY "Users can view lead_tags of their organization leads"
ON public.lead_tags
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM public.leads l
    INNER JOIN public.organization_members om ON om.organization_id = l.organization_id
    WHERE l.id = lead_tags.lead_id
      AND om.user_id = auth.uid()
      AND l.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "Users can delete lead_tags from their organization leads" ON public.lead_tags;
CREATE POLICY "Users can delete lead_tags from their organization leads"
ON public.lead_tags
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM public.leads l
    INNER JOIN public.organization_members om ON om.organization_id = l.organization_id
    WHERE l.id = lead_tags.lead_id
      AND om.user_id = auth.uid()
      AND l.deleted_at IS NULL
  )
);

-- Comentário explicativo
COMMENT ON POLICY "Users can insert lead_tags for their organization leads" ON public.lead_tags IS 
'Permite que usuários autenticados adicionem etiquetas a leads da sua organização. Verifica diretamente via organization_members para garantir funcionamento correto.';



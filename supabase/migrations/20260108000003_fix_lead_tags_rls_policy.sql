-- Corrigir política RLS de lead_tags para funcionar corretamente após criar lead
-- O problema é que a política usa get_user_organization que pode não estar disponível
-- ou pode haver problema de timing quando o lead é recém-criado

-- Primeiro, garantir que a função get_user_organization existe
CREATE OR REPLACE FUNCTION public.get_user_organization(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Buscar organização do usuário via organization_members
  SELECT organization_id INTO v_org_id
  FROM public.organization_members
  WHERE user_id = p_user_id
  ORDER BY created_at ASC
  LIMIT 1;
  
  RETURN v_org_id;
END;
$$;

-- Remover política antiga de INSERT
DROP POLICY IF EXISTS "Users can insert lead_tags for their organization leads" ON public.lead_tags;

-- Criar política melhorada de INSERT que verifica diretamente via organization_members
-- Isso evita problemas de timing e garante que funciona mesmo quando o lead é recém-criado
CREATE POLICY "Users can insert lead_tags for their organization leads"
ON public.lead_tags
FOR INSERT
WITH CHECK (
  -- Verificar se o lead existe e pertence à organização do usuário
  EXISTS (
    SELECT 1 
    FROM public.leads l
    INNER JOIN public.organization_members om ON om.organization_id = l.organization_id
    WHERE l.id = lead_tags.lead_id
      AND om.user_id = auth.uid()
  )
  -- Verificar se a tag existe e pertence à organização do usuário
  AND EXISTS (
    SELECT 1 
    FROM public.tags t
    INNER JOIN public.organization_members om ON om.organization_id = t.organization_id
    WHERE t.id = lead_tags.tag_id
      AND om.user_id = auth.uid()
  )
);

-- Comentário explicativo
COMMENT ON POLICY "Users can insert lead_tags for their organization leads" ON public.lead_tags IS 
'Permite que usuários adicionem etiquetas a leads da sua organização. Verifica diretamente via organization_members para evitar problemas de timing.';


-- ============================================
-- FIX: Corrigir RLS de scheduled_messages para funcionar em todas organizações
-- ============================================
-- Problema: Política RLS usa get_user_organization que retorna apenas a primeira organização
-- Solução: Usar user_belongs_to_org que verifica se usuário pertence à organização
-- ============================================

-- Garantir que função user_belongs_to_org existe
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_members 
    WHERE user_id = _user_id 
    AND organization_id = _org_id
  );
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.user_belongs_to_org(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_org(UUID, UUID) TO anon;

-- Remover política antiga
DROP POLICY IF EXISTS "Users can create scheduled messages in their organization" ON public.scheduled_messages;

-- Criar nova política usando user_belongs_to_org
CREATE POLICY "Users can create scheduled messages in their organization"
ON public.scheduled_messages
FOR INSERT
WITH CHECK (
  user_belongs_to_org(auth.uid(), organization_id)
  AND user_id = auth.uid()
);

-- Atualizar política UPDATE também
DROP POLICY IF EXISTS "Users can update scheduled messages in their organization" ON public.scheduled_messages;

CREATE POLICY "Users can update scheduled messages in their organization"
ON public.scheduled_messages
FOR UPDATE
USING (user_belongs_to_org(auth.uid(), organization_id))
WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

-- Atualizar política SELECT também (para consistência)
DROP POLICY IF EXISTS "Users can view scheduled messages from their organization" ON public.scheduled_messages;

CREATE POLICY "Users can view scheduled messages from their organization"
ON public.scheduled_messages
FOR SELECT
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR is_pubdigital_user(auth.uid())
);

-- Comentários
COMMENT ON POLICY "Users can create scheduled messages in their organization" ON public.scheduled_messages IS 
'Permite que usuários criem mensagens agendadas em qualquer organização que pertencem. Usa user_belongs_to_org para verificar pertencimento, não apenas primeira organização.';

COMMENT ON POLICY "Users can update scheduled messages in their organization" ON public.scheduled_messages IS 
'Permite que usuários atualizem mensagens agendadas em qualquer organização que pertencem. Usa user_belongs_to_org para verificar pertencimento.';

COMMENT ON POLICY "Users can view scheduled messages from their organization" ON public.scheduled_messages IS 
'Permite que usuários vejam mensagens agendadas de qualquer organização que pertencem. Usa user_belongs_to_org para verificar pertencimento.';

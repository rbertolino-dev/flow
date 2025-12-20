-- Corrigir políticas RLS da tabela scheduled_messages

-- Remover todas as políticas antigas
DROP POLICY IF EXISTS "Users can view their own scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can create their own scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can update their own scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can delete their own scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Super admins can view all scheduled_messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can create organization scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can update organization scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can delete organization scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can view organization scheduled messages" ON public.scheduled_messages;

-- Tornar organization_id NOT NULL
ALTER TABLE public.scheduled_messages 
ALTER COLUMN organization_id SET NOT NULL;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_organization_id 
ON public.scheduled_messages(organization_id);

-- Criar índice para consulta por lead
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_lead_id 
ON public.scheduled_messages(lead_id);

-- Política SELECT para usuários da organização
CREATE POLICY "Users can view scheduled messages from their organization"
ON public.scheduled_messages
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
);

-- Política SELECT para super admins
CREATE POLICY "Super admins can view all scheduled_messages"
ON public.scheduled_messages
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

-- Política INSERT
CREATE POLICY "Users can create scheduled messages in their organization"
ON public.scheduled_messages
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  AND user_id = auth.uid()
);

-- Política UPDATE
CREATE POLICY "Users can update scheduled messages in their organization"
ON public.scheduled_messages
FOR UPDATE
USING (organization_id = get_user_organization(auth.uid()))
WITH CHECK (organization_id = get_user_organization(auth.uid()));

-- Política DELETE
CREATE POLICY "Users can delete their own scheduled messages"
ON public.scheduled_messages
FOR DELETE
USING (
  user_id = auth.uid()
  AND organization_id = get_user_organization(auth.uid())
);

COMMENT ON COLUMN public.scheduled_messages.organization_id IS 'ID da organização à qual a mensagem agendada pertence';
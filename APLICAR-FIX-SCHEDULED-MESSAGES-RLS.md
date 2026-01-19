# 🔧 FIX: Corrigir RLS de scheduled_messages para todas organizações

## 📋 Problema Identificado

O agendamento de mensagens só funciona na organização "pubdigital" porque a política RLS usa `get_user_organization(auth.uid())` que retorna apenas a **primeira organização** do usuário.

Se o usuário tem múltiplas organizações e está usando uma diferente da primeira, a política RLS bloqueia a inserção.

## ✅ Solução

Mudar a política RLS para usar `user_belongs_to_org(auth.uid(), organization_id)` que verifica se o usuário **pertence** à organização, não apenas se é a primeira.

## 🚀 Como Aplicar

Execute este SQL no Supabase SQL Editor:

```sql
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
```

## ✅ Verificação

Após aplicar, teste agendando uma mensagem em uma organização diferente de "pubdigital".

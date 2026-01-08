# Aplicar Migration: Fix RLS Policy para lead_tags

## Problema
Ao criar um novo lead e tentar adicionar uma etiqueta, ocorre erro 403 (Forbidden) com mensagem:
```
new row violates row-level security policy for table "lead_tags"
```

## Causa
A política RLS está usando `get_user_organization(auth.uid())` que pode não estar funcionando corretamente ou pode haver problema de timing quando o lead é recém-criado.

## Solução
Aplicar a migration que:
1. Garante que a função `get_user_organization` existe e funciona corretamente
2. Melhora a política RLS de INSERT para usar verificação direta via `organization_members` ao invés de função

## Como Aplicar

### Opção 1: Via Supabase SQL Editor (Recomendado)
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Cole o conteúdo do arquivo `supabase/migrations/20260108000003_fix_lead_tags_rls_policy.sql`
3. Execute o SQL
4. Verifique se não houve erros

### Opção 2: Via Supabase CLI (se conseguir conectar)
```bash
cd /root/kanban-buzz-95241
supabase db push
```

## Conteúdo da Migration

```sql
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
```

## Após Aplicar
1. Teste criar um novo lead e adicionar uma etiqueta
2. Verifique se o erro 403 não ocorre mais
3. Se ainda houver erro, verifique os logs do console do navegador

## Notas
- A migration não causa erro se a função já existir (usa CREATE OR REPLACE)
- A migration não causa erro se a política já existir (usa DROP POLICY IF EXISTS)
- A nova política é mais robusta e evita problemas de timing


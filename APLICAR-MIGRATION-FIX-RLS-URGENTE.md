# ⚠️ URGENTE: Aplicar Migration para Corrigir Erros RLS

## Problemas Identificados

1. **Erro 403 ao adicionar etiqueta ao criar lead**: `new row violates row-level security policy for table "lead_tags"`
2. **Erro 409 ao vincular produto ao criar lead**: Produto já está vinculado (não crítico, mas gera erro)

## Solução

Aplicar a migration `20260108000004_fix_rls_lead_tags_and_lead_products.sql` que corrige ambos os problemas.

## ⚡ APLICAR AGORA (Via Supabase SQL Editor)

1. **Acesse**: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. **Cole o SQL abaixo** e execute:

```sql
-- Corrigir políticas RLS de lead_tags e lead_products
-- Problema: Políticas RLS falham quando lead é recém-criado (problema de timing)
-- Solução: Usar verificação direta via organization_members ao invés de função

-- ============================================
-- 1. Garantir que função get_user_organization existe
-- ============================================
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

-- ============================================
-- 2. Corrigir política RLS de lead_tags (INSERT)
-- ============================================
DROP POLICY IF EXISTS "Users can insert lead_tags for their organization leads" ON public.lead_tags;

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

COMMENT ON POLICY "Users can insert lead_tags for their organization leads" ON public.lead_tags IS 
'Permite que usuários adicionem etiquetas a leads da sua organização. Verifica diretamente via organization_members para evitar problemas de timing.';

-- ============================================
-- 3. Corrigir política RLS de lead_products (INSERT)
-- ============================================
DROP POLICY IF EXISTS "lead_products_insert_org_members" ON public.lead_products;

CREATE POLICY "lead_products_insert_org_members"
ON public.lead_products
FOR INSERT
WITH CHECK (
  -- Verificar se o lead existe e pertence à organização do usuário
  EXISTS (
    SELECT 1
    FROM public.leads l
    INNER JOIN public.organization_members om ON om.organization_id = l.organization_id
    WHERE l.id = lead_products.lead_id
      AND om.user_id = auth.uid()
  )
  -- Verificar se o produto existe e pertence à organização do usuário
  AND EXISTS (
    SELECT 1
    FROM public.products p
    INNER JOIN public.organization_members om ON om.organization_id = p.organization_id
    WHERE p.id = lead_products.product_id
      AND om.user_id = auth.uid()
  )
);

COMMENT ON POLICY "lead_products_insert_org_members" ON public.lead_products IS 
'Permite que usuários vinculem produtos a leads da sua organização. Verifica diretamente via organization_members para evitar problemas de timing.';

-- ============================================
-- 4. Garantir que RLS está habilitado
-- ============================================
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_products ENABLE ROW LEVEL SECURITY;
```

3. **Clique em "Run"** ou pressione `Ctrl+Enter`
4. **Verifique** se não houve erros
5. **Teste** criando um novo lead com etiqueta

## ✅ Após Aplicar

1. Teste criar um novo lead com etiqueta
2. O erro 403 não deve mais ocorrer
3. O erro 409 em lead_products será ignorado (já tratado no código)

## 📝 Notas

- A migration não causa erro se as políticas já existirem (usa DROP POLICY IF EXISTS)
- A migration não causa erro se a função já existir (usa CREATE OR REPLACE)
- As novas políticas são mais robustas e evitam problemas de timing


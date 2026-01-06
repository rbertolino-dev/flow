# 🔧 CORREÇÃO URGENTE: Erro "column o.slug does not exist"

## ❌ Problema

Erro ao carregar campanhas:
```
Erro ao carregar campanhas
column o.slug does not exist
```

**Causa:** A função `is_pubdigital_user` está sendo chamada nas políticas RLS de `broadcast_campaigns` e `broadcast_queue` para **TODAS as organizações** (não apenas pubdigital). Quando a função tenta acessar a coluna `o.slug` que não existe na tabela `organizations`, ela falha e bloqueia o acesso para todas as organizações.

## ✅ Solução

Aplicar o SQL abaixo no **Supabase SQL Editor**:

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Cole o SQL abaixo
3. Execute (Ctrl+Enter)

## 📄 SQL para Aplicar

```sql
-- ==========================================
-- CORREÇÃO URGENTE: Remover referência a coluna slug inexistente
-- ==========================================
-- Erro: "column o.slug does not exist"
-- Causa: Função is_pubdigital_user tenta acessar coluna slug que não existe
-- ==========================================

-- Corrigir função is_pubdigital_user removendo referência a slug
CREATE OR REPLACE FUNCTION public.is_pubdigital_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = _user_id
      AND LOWER(o.name) LIKE '%pubdigital%'
  );
END;
$$;

-- Garantir permissões GRANT
GRANT EXECUTE ON FUNCTION public.is_pubdigital_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pubdigital_user(UUID) TO anon;

-- Forçar atualização do schema cache
NOTIFY pgrst, 'reload schema';
```

## ✅ Verificação

Após aplicar o SQL:
1. Recarregue a página do módulo de disparo em massa
2. O erro "column o.slug does not exist" deve desaparecer
3. As campanhas devem carregar corretamente
4. **Todas as organizações** (incluindo "iclass sistemas" e outras) devem conseguir acessar

## 📝 O Que Foi Corrigido

1. ✅ Removida referência a `o.slug` (coluna não existe)
2. ✅ Função agora usa apenas `o.name` para verificar se é pubdigital
3. ✅ Permissões GRANT mantidas para RLS funcionar
4. ✅ Schema cache atualizado

## 🔍 Por Que Isso Resolve?

As políticas RLS das tabelas `broadcast_campaigns` e `broadcast_queue` usam:
```sql
OR is_pubdigital_user(auth.uid())
```

Isso significa que a função é chamada para **TODAS as organizações** quando as políticas RLS são avaliadas. Se a função tenta acessar uma coluna que não existe (`slug`), ela falha e bloqueia o acesso para todas as organizações.

**Antes:**
- Função tenta acessar `o.slug` ❌
- Coluna não existe → Erro
- Todas organizações bloqueadas

**Depois:**
- Função usa apenas `o.name` ✅
- Sem erros
- Todas organizações funcionam ✅


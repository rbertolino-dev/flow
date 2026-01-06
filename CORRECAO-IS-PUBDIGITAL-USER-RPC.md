# 🔧 Correção: Erro 400 ao chamar is_pubdigital_user via RPC

## ❌ Problema

Erro no console do navegador:
```
POST https://ogeljmbhqxpfjbpnbwog.supabase.co/rest/v1/rpc/is_pubdigital_user 400 (Bad Request)
```

**Causa:** A função `is_pubdigital_user` existe no banco, mas não tem permissões GRANT para ser acessível via RPC (PostgREST).

**⚠️ IMPORTANTE:** Este erro afeta **TODAS as organizações**, não apenas pubdigital! As políticas RLS das tabelas `broadcast_campaigns` e `broadcast_queue` usam `is_pubdigital_user(auth.uid())` dentro das políticas. Quando o PostgREST avalia essas políticas, ele precisa executar a função, mas sem permissões GRANT, ela falha com erro 400, bloqueando o acesso para todas as organizações (incluindo "iclass sistemas").

## ✅ Solução

Aplicar o SQL abaixo no **Supabase SQL Editor**:

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Cole o SQL abaixo
3. Execute (Ctrl+Enter ou botão "Run")

## 📄 SQL para Aplicar

```sql
-- ==========================================
-- CORREÇÃO: Função is_pubdigital_user não acessível via RPC
-- ==========================================
-- Erro: POST /rest/v1/rpc/is_pubdigital_user 400 (Bad Request)
-- Causa: Função existe mas não tem permissões GRANT para authenticated/anon
-- ==========================================

-- 1. Garantir que função existe com assinatura correta
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

-- 2. Garantir permissões GRANT para authenticated e anon (OBRIGATÓRIO para RPC)
GRANT EXECUTE ON FUNCTION public.is_pubdigital_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pubdigital_user(UUID) TO anon;

-- 3. Verificar se função foi criada corretamente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'is_pubdigital_user'
      AND pg_get_function_arguments(p.oid) = '_user_id uuid'
  ) THEN
    RAISE EXCEPTION 'Função is_pubdigital_user não foi criada corretamente!';
  END IF;
  
  RAISE NOTICE '✅ Função is_pubdigital_user criada/atualizada com sucesso';
  RAISE NOTICE '✅ Permissões GRANT configuradas para authenticated e anon';
END $$;

-- 4. Forçar atualização do schema cache do PostgREST (Supabase)
-- Isso garante que a função fique disponível via RPC imediatamente
NOTIFY pgrst, 'reload schema';
```

## ✅ Verificação

Após aplicar o SQL, teste se a função está acessível:

1. Recarregue a página do módulo de disparo em massa
2. Tente iniciar ou agendar uma campanha
3. O erro 400 não deve mais aparecer no console

## 📝 O Que Foi Corrigido

1. ✅ Função `is_pubdigital_user` recriada com assinatura correta
2. ✅ Permissões `GRANT EXECUTE` adicionadas para `authenticated` e `anon`
3. ✅ Schema cache do PostgREST atualizado (via NOTIFY)

## 🔍 Por Que Isso Resolve?

O PostgREST (que expõe as funções via RPC) só permite chamar funções que tenham permissões GRANT explícitas. Sem essas permissões, mesmo que a função exista, o PostgREST retorna erro 400.

**Antes:**
- Função existe ✅
- Permissões GRANT ❌
- Resultado: Erro 400

**Depois:**
- Função existe ✅
- Permissões GRANT ✅
- Resultado: RPC funciona ✅


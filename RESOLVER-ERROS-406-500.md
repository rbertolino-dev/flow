# 🔧 Resolver Erros 406 e 500

## 📋 Erros Identificados

1. **Erro 406 em `facebook_configs`**: Políticas RLS bloqueiam acesso
2. **Erro 500 no `evolution-webhook`**: Erro interno no servidor

## ✅ Solução: Aplicar Migrations de RLS

### ⚠️ IMPORTANTE: As migrations precisam ser aplicadas manualmente no Supabase Dashboard

### Passo 1: Aplicar Migration de facebook_configs

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Abra o arquivo: `supabase/migrations/20260106000002_fix_facebook_configs_rls.sql`
3. Copie TODO o conteúdo
4. Cole no SQL Editor do Supabase
5. Clique em **Run** ou pressione `Ctrl+Enter`
6. Aguarde confirmação de sucesso

### Passo 2: Aplicar Migration de evolution_logs (se ainda não aplicou)

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Abra o arquivo: `supabase/migrations/20260106000001_fix_evolution_logs_rls.sql`
3. Copie TODO o conteúdo
4. Cole no SQL Editor do Supabase
5. Clique em **Run** ou pressione `Ctrl+Enter`
6. Aguarde confirmação de sucesso

## 🔍 Verificar Erro 500 do Webhook

Após aplicar as migrations, verificar logs do webhook:

### Via Supabase Dashboard:
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions
2. Clique em `evolution-webhook`
3. Veja os logs para identificar o erro 500

### Via CLI (se tiver acesso):
```bash
supabase functions logs evolution-webhook --tail
```

## ✅ Verificação

Após aplicar as migrations:

1. **facebook_configs 406**: Deve retornar 200 (mesmo que vazio) ao invés de 406
2. **evolution-webhook 500**: Verificar logs para identificar causa específica

## 📝 Notas

- As migrations são idempotentes (podem ser executadas múltiplas vezes)
- Se houver erro ao aplicar, verificar se as tabelas existem
- O erro 500 do webhook pode estar relacionado a problemas de autenticação ou dados inválidos



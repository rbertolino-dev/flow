# 🔧 Aplicar Todas as Migrations - Resolver Erros 406 e 500

## 📋 Erros Identificados

1. **Erro 406 em `facebook_configs`**: Políticas RLS bloqueiam acesso
2. **Erro 500 no `evolution-webhook`**: Colunas `has_unread_messages` podem não existir

## ✅ Solução: Aplicar 3 Migrations

### ⚠️ IMPORTANTE: Aplicar na ordem abaixo

### Passo 1: Aplicar Migration de evolution_logs

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Abra o arquivo: `supabase/migrations/20260106000001_fix_evolution_logs_rls.sql`
3. Copie TODO o conteúdo
4. Cole no SQL Editor do Supabase
5. Clique em **Run** ou pressione `Ctrl+Enter`
6. Aguarde confirmação de sucesso

### Passo 2: Aplicar Migration de facebook_configs

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Abra o arquivo: `supabase/migrations/20260106000002_fix_facebook_configs_rls.sql`
3. Copie TODO o conteúdo
4. Cole no SQL Editor do Supabase
5. Clique em **Run** ou pressione `Ctrl+Enter`
6. Aguarde confirmação de sucesso

### Passo 3: Aplicar Migration de leads (has_unread_messages)

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Abra o arquivo: `supabase/migrations/20260106000003_fix_leads_unread_columns.sql`
3. Copie TODO o conteúdo
4. Cole no SQL Editor do Supabase
5. Clique em **Run** ou pressione `Ctrl+Enter`
6. Aguarde confirmação de sucesso

## ✅ Verificação

Após aplicar todas as migrations:

1. **facebook_configs 406**: Deve retornar 200 (mesmo que vazio) ao invés de 406
2. **evolution-webhook 500**: Deve funcionar corretamente (colunas existem)

## 📝 Notas

- As migrations são idempotentes (podem ser executadas múltiplas vezes)
- Se houver erro ao aplicar, verificar se as tabelas existem
- A migration de leads adiciona colunas se não existirem (não causa erro se já existirem)



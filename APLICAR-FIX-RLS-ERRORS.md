# 🔧 Aplicar Correções de RLS - Erros 404 e 406

## 📋 Problemas Identificados

1. **Erro 404 em `evolution_logs`**: Tabela existe mas políticas RLS bloqueiam acesso
2. **Erro 406 em `facebook_configs`**: Políticas RLS bloqueiam acesso (Not Acceptable)
3. **Erro 500 no webhook `evolution-webhook`**: Erro interno no servidor

## ✅ Correções Criadas

### Migration 1: `20260106000001_fix_evolution_logs_rls.sql`
- Adiciona coluna `organization_id` se não existir
- Atualiza políticas RLS para permitir acesso por organização
- Permite que usuários vejam logs da própria organização

### Migration 2: `20260106000002_fix_facebook_configs_rls.sql`
- Remove políticas antigas conflitantes
- Cria políticas RLS simplificadas baseadas em `organization_members`
- Remove dependência de `is_pubdigital_user()` que pode estar falhando

## 📋 Método: Via Supabase Dashboard (Recomendado)

### Passo 1: Acessar SQL Editor
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Faça login se necessário

### Passo 2: Aplicar Migration 1 (evolution_logs)
**IMPORTANTE:** Esta migration agora cria a tabela `evolution_logs` se ela não existir.

1. Abra o arquivo: `supabase/migrations/20260106000001_fix_evolution_logs_rls.sql`
2. Copie TODO o conteúdo
3. Cole no SQL Editor do Supabase
4. Clique em **Run** ou pressione `Ctrl+Enter`
5. Aguarde confirmação de sucesso

**Nota:** Se a tabela já existir, a migration apenas adiciona a coluna `organization_id` e atualiza as políticas RLS.

### Passo 3: Aplicar Migration 2 (facebook_configs)
1. Abra o arquivo: `supabase/migrations/20260106000002_fix_facebook_configs_rls.sql`
2. Copie TODO o conteúdo
3. Cole no SQL Editor do Supabase
4. Clique em **Run** ou pressione `Ctrl+Enter`
5. Aguarde confirmação de sucesso

## 🔍 Verificar Erro 500 do Webhook

Após aplicar as migrations, verificar logs do webhook:

```bash
supabase functions logs evolution-webhook --tail
```

Ou via Supabase Dashboard:
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions
2. Clique em `evolution-webhook`
3. Veja os logs para identificar o erro 500

## ✅ Verificação

Após aplicar as migrations, verificar se os erros foram resolvidos:

1. **evolution_logs 404**: Deve retornar dados (mesmo que vazio) ao invés de 404
2. **facebook_configs 406**: Deve retornar dados ou 200 (mesmo que vazio) ao invés de 406
3. **evolution-webhook 500**: Verificar logs para identificar causa específica

## 📝 Notas

- As migrations são idempotentes (podem ser executadas múltiplas vezes)
- Se houver erro, verificar se as tabelas existem
- Se `organization_id` já existir em `evolution_logs`, a migration apenas atualiza as políticas


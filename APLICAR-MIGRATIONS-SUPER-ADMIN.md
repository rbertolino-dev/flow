# 🚀 Aplicar Migrations do Super Admin

## Migrations Criadas

1. **20250131000003_fix_organization_limits_jsonb_validation.sql**
   - Normaliza `enabled_features` e `disabled_features` para sempre serem arrays JSONB válidos
   - Cria função `normalize_jsonb_array()` 
   - Cria trigger para validar antes de INSERT/UPDATE
   - Corrige dados existentes corrompidos

2. **20250131000004_fix_organization_limits_rls_insert.sql**
   - Corrige políticas RLS para permitir INSERT explícito
   - Separa políticas para INSERT, UPDATE e DELETE
   - Aplica em `organization_limits` e `organization_evolution_providers`

---

## 📋 Método 1: Via Supabase Dashboard (Recomendado)

### Passo 1: Acessar SQL Editor
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Faça login se necessário

### Passo 2: Aplicar Migration 1
1. Abra o arquivo: `supabase/migrations/20250131000003_fix_organization_limits_jsonb_validation.sql`
2. Copie TODO o conteúdo
3. Cole no SQL Editor do Supabase
4. Clique em **Run** ou pressione `Ctrl+Enter`
5. Aguarde confirmação de sucesso

### Passo 3: Aplicar Migration 2
1. Abra o arquivo: `supabase/migrations/20250131000004_fix_organization_limits_rls_insert.sql`
2. Copie TODO o conteúdo
3. Cole no SQL Editor do Supabase
4. Clique em **Run** ou pressione `Ctrl+Enter`
5. Aguarde confirmação de sucesso

---

## 📋 Método 2: Via Supabase CLI (Se tiver SERVICE_ROLE_KEY)

### Passo 1: Configurar Variável de Ambiente
```bash
export SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key-aqui"
```

### Passo 2: Executar Script
```bash
cd /root/kanban-buzz-95241
node scripts/aplicar-migrations-super-admin.js
```

---

## 📋 Método 3: Via psql (Se tiver credenciais de admin)

### Passo 1: Obter Connection String
A connection string está no formato:
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### Passo 2: Aplicar Migrations
```bash
cd /root/kanban-buzz-95241

# Migration 1
psql "[CONNECTION_STRING]" -f supabase/migrations/20250131000003_fix_organization_limits_jsonb_validation.sql

# Migration 2
psql "[CONNECTION_STRING]" -f supabase/migrations/20250131000004_fix_organization_limits_rls_insert.sql
```

---

## ✅ Verificar se Aplicou Corretamente

### Verificar Função normalize_jsonb_array
```sql
SELECT proname 
FROM pg_proc 
WHERE proname = 'normalize_jsonb_array';
```
Deve retornar 1 linha.

### Verificar Trigger
```sql
SELECT tgname 
FROM pg_trigger 
WHERE tgname = 'trg_validate_organization_limits_jsonb';
```
Deve retornar 1 linha.

### Verificar Políticas RLS
```sql
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'organization_limits' 
  AND policyname LIKE '%Super admins%';
```
Deve retornar pelo menos 3 políticas (insert, update, delete).

---

## 🔍 Troubleshooting

### Erro: "function normalize_jsonb_array already exists"
- ✅ Normal, a função já existe. A migration usa `CREATE OR REPLACE`.

### Erro: "policy already exists"
- ✅ Normal, a migration usa `DROP POLICY IF EXISTS` antes de criar.

### Erro: "permission denied"
- ❌ Verifique se está usando SERVICE_ROLE_KEY ou credenciais de admin
- ❌ Usuário viewer_user não tem permissão (é read-only)

---

## 📝 Notas Importantes

1. **Ordem Importante**: Aplique as migrations na ordem (03 antes de 04)
2. **Backup**: As migrations são seguras (usam `IF EXISTS` e `OR REPLACE`)
3. **Dados**: Nenhum dado será perdido, apenas normalizado
4. **RLS**: As novas políticas são mais específicas e seguras

---

**Última atualização**: 2026-01-05


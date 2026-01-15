# 🔧 Aplicar Migration: Foreign Keys para scheduled_messages

## 📋 Problema

O erro ocorre porque a tabela `scheduled_messages` não tem foreign keys configuradas para `lead_id` e `instance_id`, impedindo que o Supabase faça joins automáticos.

**Erro:**
```
Could not find a relationship between 'scheduled_messages' and 'leads' in the schema cache
```

## ✅ Solução

Aplicar a migration que adiciona as foreign keys necessárias.

## 🚀 Como Aplicar

### Opção 1: Via Supabase SQL Editor (Recomendado)

1. Acesse o Supabase Dashboard:
   - URL: https://supabase.com/dashboard
   - Projeto: ogeljmbhqxpfjbpnbwog

2. Vá em **SQL Editor** (menu lateral)

3. Cole o conteúdo do arquivo:
   ```
   supabase/migrations/20260115000004_add_foreign_keys_scheduled_messages.sql
   ```

4. Clique em **Run** (ou pressione Ctrl+Enter)

5. Aguarde a confirmação de sucesso

### Opção 2: Via Supabase CLI (se configurado)

```bash
cd /root/kanban-buzz-95241
supabase db push
```

## 📄 Conteúdo da Migration

A migration adiciona:
- ✅ Foreign key `scheduled_messages_lead_id_fkey`: `lead_id` → `leads(id)`
- ✅ Foreign key `scheduled_messages_instance_id_fkey`: `instance_id` → `evolution_config(id)`
- ✅ Atualiza cache do PostgREST para reconhecer relacionamentos

## ⚠️ Importante

Após aplicar a migration:
1. Aguarde 30-60 segundos para o PostgREST atualizar o cache
2. Recarregue a página (F5) para testar
3. O erro deve desaparecer e os joins devem funcionar

## 🔍 Verificação

Após aplicar, você pode verificar se as foreign keys foram criadas:

```sql
SELECT 
  constraint_name,
  table_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'scheduled_messages'
  AND constraint_type = 'FOREIGN KEY';
```

Deve retornar:
- `scheduled_messages_lead_id_fkey`
- `scheduled_messages_instance_id_fkey`

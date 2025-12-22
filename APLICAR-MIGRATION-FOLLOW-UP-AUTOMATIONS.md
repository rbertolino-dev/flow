# 🔧 Aplicar Migration: Criar Tabela follow_up_step_automations

## ⚠️ Problema

A tabela `follow_up_step_automations` não existe no banco de dados, causando erro 404 ao tentar carregar automações de etapas de follow-up.

**Erro:**
```
Could not find the table 'public.follow_up_step_automations' in the schema cache
GET .../follow_up_step_automations?select=*&step_id=eq.xxx 404 (Not Found)
```

## ✅ Solução

Aplicar a migration `20251222202000_create_follow_up_step_automations_if_not_exists.sql` que cria a tabela com estrutura completa e políticas RLS.

## 📋 Como Aplicar

### Opção 1: Via Supabase SQL Editor (Recomendado)

1. Acesse o **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **SQL Editor** (menu lateral)
4. Clique em **New Query**
5. Cole o conteúdo do arquivo `supabase/migrations/20251222202000_create_follow_up_step_automations_if_not_exists.sql`
6. Clique em **Run** (ou pressione `Ctrl+Enter`)

### Opção 2: Via Supabase CLI

```bash
cd /root/kanban-buzz-95241
supabase db push
```

## ✅ Verificação

Após aplicar a migration, verifique se a tabela foi criada:

```sql
-- Verificar se tabela existe
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'follow_up_step_automations'
);

-- Verificar estrutura
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'follow_up_step_automations'
ORDER BY ordinal_position;

-- Verificar políticas RLS
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'follow_up_step_automations';
```

## 📝 O Que a Migration Faz

1. ✅ Cria tabela `follow_up_step_automations` se não existir
2. ✅ Cria índices para performance
3. ✅ Habilita RLS (Row Level Security)
4. ✅ Cria políticas RLS para SELECT, INSERT, UPDATE, DELETE
5. ✅ Adiciona comentários explicativos

## 🔄 Após Aplicar

Após aplicar a migration:
1. Recarregue a página do sistema
2. Tente adicionar um novo follow-up
3. O erro 404 deve desaparecer
4. As automações devem carregar corretamente

## ⚠️ Importante

- Esta migration é **idempotente** (pode ser executada múltiplas vezes sem problemas)
- Usa `CREATE TABLE IF NOT EXISTS` para não falhar se a tabela já existir
- Usa `DROP POLICY IF EXISTS` antes de criar políticas para evitar conflitos


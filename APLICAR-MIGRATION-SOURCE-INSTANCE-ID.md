# 🔧 Aplicar Migration: Adicionar source_instance_id na tabela leads

## 📋 Problema Identificado

**Erro no webhook:**
```
Could not find the 'source_instance_id' column of 'leads' in the schema cache
```

A coluna `source_instance_id` não existe na tabela `leads`, causando erro 500 no webhook.

## ✅ Solução: Aplicar Migration

### Passo 1: Acessar SQL Editor

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Faça login se necessário

### Passo 2: Aplicar Migration

1. Abra o arquivo: `supabase/migrations/20260108000001_add_source_instance_id_to_leads.sql`
2. Copie TODO o conteúdo
3. Cole no SQL Editor do Supabase
4. Clique em **Run** ou pressione `Ctrl+Enter`
5. Aguarde confirmação de sucesso

## ✅ O Que a Migration Faz

1. **Adiciona coluna `source_instance_id`**:
   - Tipo: UUID
   - Referência: `evolution_configs(id)` ou `evolution_config(id)` (detecta automaticamente)
   - ON DELETE SET NULL (não deleta leads se instância for removida)

2. **Adiciona coluna `source_instance_name`**:
   - Tipo: TEXT
   - Armazena nome da instância para referência rápida

3. **Cria índice**:
   - `idx_leads_source_instance_id` para melhor performance

## 🔍 Verificação

Após aplicar a migration:

1. **Verificar se colunas foram criadas:**
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_schema = 'public' 
     AND table_name = 'leads' 
     AND column_name IN ('source_instance_id', 'source_instance_name');
   ```

2. **Testar webhook novamente:**
   - Acesse Configurações → Integrações → WhatsApp
   - Vá na aba "Diagnóstico" da instância
   - Clique em "5. Simular recebimento de webhook"
   - Deve funcionar agora sem erro 500

## 📝 Notas

- A migration é idempotente (pode ser executada múltiplas vezes)
- Detecta automaticamente o nome correto da tabela de referência
- Não causa erro se as colunas já existirem




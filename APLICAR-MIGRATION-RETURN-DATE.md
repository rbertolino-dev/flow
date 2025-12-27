# 🚀 Aplicar Migration: return_date na tabela leads

## ⚠️ URGENTE

A coluna `return_date` não existe no schema cache do Supabase, causando erro ao salvar data de retorno.

## 📋 Como Aplicar

### Opção 1: Via SQL Editor do Supabase (Recomendado)

1. **Acesse o SQL Editor:**
   - https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

2. **Cole o SQL abaixo e execute:**

```sql
-- Adicionar coluna return_date na tabela leads se não existir
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS return_date TIMESTAMP WITH TIME ZONE;

-- Criar índice para melhorar performance das buscas por data de retorno
CREATE INDEX IF NOT EXISTS idx_leads_return_date 
  ON public.leads(return_date) 
  WHERE return_date IS NOT NULL;

-- Comentário na coluna
COMMENT ON COLUMN public.leads.return_date IS 'Data de retorno agendada para o lead';
```

3. **Clique em RUN (ou pressione Ctrl+Enter)**

4. **Verifique se foi aplicado:**
   - Deve aparecer "Success. No rows returned"
   - Ou "CREATE INDEX" se o índice foi criado

### Opção 2: Via Supabase CLI (se disponível)

```bash
cd /root/kanban-buzz-95241
supabase link --project-ref ogeljmbhqxpfjbpnbwog --yes
supabase db push --include-all
```

## ✅ Verificação

Após aplicar, teste:
1. Abra um lead no CRM
2. Selecione uma data de retorno
3. Clique em salvar
4. Não deve mais aparecer erro no console

## 📝 Arquivo da Migration

A migration está em:
- `supabase/migrations/20251223200000_add_return_date_to_leads.sql`


# ⚠️ URGENTE: Aplicar Migration para Repetição, Combo e Cancelamento

## 🔴 Erro Atual

```
Could not find the 'original_scheduled_date' column of 'scheduled_messages' in the schema cache
```

## ✅ Solução: Aplicar Migration

A migration `20260115000001_add_repeat_combo_cancel_to_scheduled_messages.sql` precisa ser aplicada no banco de dados.

### 📋 Método 1: Via Supabase SQL Editor (Recomendado - Mais Rápido)

1. **Acesse o SQL Editor do Supabase:**
   - URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
   - Faça login se necessário

2. **Copie e cole o SQL abaixo:**

```sql
-- ============================================
-- Adicionar campos de repetição, combo e cancelamento em scheduled_messages
-- ============================================
-- Esta migration adiciona suporte para:
-- 1. Repetição de mensagens (diária, semanal, mensal)
-- 2. Mensagens em combo (segunda mensagem vinculada)
-- 3. Motivo de cancelamento
-- ============================================

-- Adicionar campos de repetição
ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS repeat_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS repeat_period TEXT CHECK (repeat_period IN ('daily', 'weekly', 'monthly', 'yearly')) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS repeat_count INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS repeat_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS original_scheduled_date DATE DEFAULT NULL; -- Data original para repetir sempre no mesmo dia

-- Adicionar campos de combo (mensagem vinculada)
ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS parent_message_id UUID REFERENCES public.scheduled_messages(id) ON DELETE CASCADE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_combo_message BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS combo_delay_days INTEGER DEFAULT NULL; -- Dias após a primeira mensagem

-- Adicionar campo de cancelamento com motivo
ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_repeat_enabled 
  ON public.scheduled_messages(repeat_enabled) 
  WHERE repeat_enabled = true;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_parent_message 
  ON public.scheduled_messages(parent_message_id) 
  WHERE parent_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_is_combo 
  ON public.scheduled_messages(is_combo_message) 
  WHERE is_combo_message = true;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_original_date 
  ON public.scheduled_messages(original_scheduled_date) 
  WHERE original_scheduled_date IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.scheduled_messages.repeat_enabled IS 'Se a mensagem deve ser repetida';
COMMENT ON COLUMN public.scheduled_messages.repeat_period IS 'Período de repetição: daily, weekly, monthly, yearly';
COMMENT ON COLUMN public.scheduled_messages.repeat_count IS 'Quantas vezes a mensagem será repetida';
COMMENT ON COLUMN public.scheduled_messages.repeat_until IS 'Data limite para repetição (opcional)';
COMMENT ON COLUMN public.scheduled_messages.original_scheduled_date IS 'Data original do agendamento (para repetir sempre no mesmo dia do mês)';
COMMENT ON COLUMN public.scheduled_messages.parent_message_id IS 'ID da mensagem pai (para mensagens em combo)';
COMMENT ON COLUMN public.scheduled_messages.is_combo_message IS 'Se esta é a segunda mensagem de um combo';
COMMENT ON COLUMN public.scheduled_messages.combo_delay_days IS 'Dias após a primeira mensagem para enviar a segunda';
COMMENT ON COLUMN public.scheduled_messages.cancel_reason IS 'Motivo do cancelamento da mensagem';
COMMENT ON COLUMN public.scheduled_messages.cancelled_at IS 'Data/hora do cancelamento';
```

3. **Clique em "Run" ou pressione `Ctrl+Enter`**

4. **Aguarde confirmação de sucesso**

### 📋 Método 2: Via Script Automático

Execute o script abaixo (se tiver acesso ao Supabase CLI):

```bash
cd /root/kanban-buzz-95241
cat supabase/migrations/20260115000001_add_repeat_combo_cancel_to_scheduled_messages.sql
```

Depois copie o conteúdo e cole no SQL Editor do Supabase.

## ✅ Verificação Após Aplicar

Após aplicar a migration, verifique se as colunas foram criadas:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'scheduled_messages'
  AND column_name IN (
    'repeat_enabled', 
    'repeat_period', 
    'repeat_count', 
    'repeat_until',
    'original_scheduled_date',
    'parent_message_id',
    'is_combo_message',
    'combo_delay_days',
    'cancel_reason',
    'cancelled_at'
  )
ORDER BY column_name;
```

Você deve ver todas as 10 colunas listadas.

## 🔄 Após Aplicar

1. **Recarregue a página** do funil de vendas
2. **Tente agendar uma mensagem novamente**
3. O erro deve desaparecer

## 📝 Nota

O erro ocorre porque o código frontend está tentando usar a coluna `original_scheduled_date` que ainda não existe no banco. Após aplicar a migration, tudo funcionará corretamente.

# ⚠️ URGENTE: Aplicar Migration para Corrigir Erro

## 🔴 Erro Atual

```
Could not find the 'original_scheduled_date' column of 'scheduled_messages' in the schema cache
```

## ✅ Solução Rápida (2 minutos)

### Passo 1: Acessar SQL Editor
1. Abra: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Faça login se necessário

### Passo 2: Copiar e Colar o SQL Abaixo

```sql
-- Adicionar campos de repetição, combo e cancelamento
ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS repeat_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS repeat_period TEXT CHECK (repeat_period IN ('daily', 'weekly', 'monthly', 'yearly')) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS repeat_count INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS repeat_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS original_scheduled_date DATE DEFAULT NULL;

ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS parent_message_id UUID REFERENCES public.scheduled_messages(id) ON DELETE CASCADE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_combo_message BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS combo_delay_days INTEGER DEFAULT NULL;

ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

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
```

### Passo 3: Executar
- Clique em **"Run"** ou pressione `Ctrl+Enter`
- Aguarde confirmação de sucesso

### Passo 4: Recarregar Página
- Recarregue a página do funil de vendas (F5)
- Tente agendar uma mensagem novamente

## ✅ Verificação

Após aplicar, execute este SQL para verificar:

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'scheduled_messages'
  AND column_name IN (
    'original_scheduled_date',
    'repeat_enabled',
    'repeat_period',
    'parent_message_id',
    'is_combo_message',
    'cancel_reason'
  );
```

Você deve ver 6 colunas listadas.

# 🚨 APLICAR MIGRATION BROADCAST CAMPAIGNS - URGENTE

## ⚠️ Erro Atual

```
POST /rest/v1/broadcast_campaigns 400 (Bad Request)
Could not find the 'sending_method' column of 'broadcast_campaigns' in the schema cache
```

## ✅ Solução: Aplicar Migration

### Método 1: Via Supabase Dashboard (RECOMENDADO)

1. **Acesse:** https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

2. **Cole e execute este SQL:**

```sql
-- Permitir instance_id NULL
ALTER TABLE public.broadcast_campaigns 
ALTER COLUMN instance_id DROP NOT NULL;

-- Adicionar coluna sending_method
ALTER TABLE public.broadcast_campaigns 
ADD COLUMN IF NOT EXISTS sending_method TEXT DEFAULT 'single';

-- Comentários
COMMENT ON COLUMN public.broadcast_campaigns.instance_id IS 
  'ID da instância (NULL quando campanha usa múltiplas instâncias - rotate ou separate)';

COMMENT ON COLUMN public.broadcast_campaigns.sending_method IS 
  'Método de envio: single (uma instância), rotate (rotacionar entre instâncias), separate (disparar separadamente)';
```

3. **Clique em "Run"** para executar

### Método 2: Via Função SQL (Automático)

Se a função `apply_broadcast_migration` já existir no banco, execute:

```sql
SELECT public.apply_broadcast_migration();
```

### Método 3: Criar Função e Aplicar

Execute este SQL completo:

```sql
-- Criar função
CREATE OR REPLACE FUNCTION public.apply_broadcast_migration()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_text TEXT := '';
BEGIN
  -- Permitir instance_id NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaigns'
      AND column_name = 'instance_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.broadcast_campaigns
    ALTER COLUMN instance_id DROP NOT NULL;
    result_text := result_text || '✅ instance_id agora permite NULL. ';
  END IF;

  -- Adicionar coluna sending_method
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaigns'
      AND column_name = 'sending_method'
  ) THEN
    ALTER TABLE public.broadcast_campaigns
    ADD COLUMN sending_method TEXT DEFAULT 'single';
    result_text := result_text || '✅ Coluna sending_method adicionada. ';
  END IF;

  RETURN result_text || 'Migration concluída!';
EXCEPTION
  WHEN OTHERS THEN
    RETURN '❌ Erro: ' || SQLERRM;
END;
$$;

-- Executar função
SELECT public.apply_broadcast_migration();
```

## ✅ Verificação

Após aplicar, verifique:

```sql
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'broadcast_campaigns' 
  AND column_name IN ('instance_id', 'sending_method');
```

**Resultado esperado:**
- `instance_id`: `is_nullable = 'YES'`
- `sending_method`: coluna existe com `data_type = 'text'`

## 🔄 Após Aplicar

1. O código já tem fallback automático
2. Tente criar uma campanha novamente
3. Se ainda der erro, recarregue a página (Ctrl+F5) para limpar cache


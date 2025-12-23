# 🔧 Aplicar Migration: Fix Broadcast Campaign Templates RLS

## 📋 Migration: `20250123000000_fix_broadcast_campaign_templates_rls.sql`

### 🚀 Método Rápido: Via Supabase Dashboard

1. **Acesse o Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
   ```

2. **Cole o SQL abaixo e execute:**

```sql
-- ============================================
-- FIX: Corrigir política RLS para broadcast_campaign_templates
-- ============================================

-- Garantir que a coluna message_variations existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaign_templates'
      AND column_name = 'message_variations'
  ) THEN
    ALTER TABLE public.broadcast_campaign_templates
    ADD COLUMN message_variations JSONB DEFAULT '[]'::jsonb;
    
    COMMENT ON COLUMN public.broadcast_campaign_templates.message_variations IS 
      'Array de variações de mensagem em formato JSONB';
  END IF;
END $$;

-- Garantir que a coluna permite NULL (para compatibilidade)
DO $$
BEGIN
  ALTER TABLE public.broadcast_campaign_templates
  ALTER COLUMN message_variations DROP NOT NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- Coluna já permite NULL ou não existe NOT NULL constraint
    NULL;
END $$;

-- Recriar política RLS de INSERT para garantir que funciona corretamente
DO $$
BEGIN
  -- Remover política antiga se existir
  DROP POLICY IF EXISTS "Users can create organization campaign templates" 
    ON public.broadcast_campaign_templates;
  
  -- Criar nova política com verificação mais robusta
  CREATE POLICY "Users can create organization campaign templates"
    ON public.broadcast_campaign_templates
    FOR INSERT
    WITH CHECK (
      organization_id = public.get_user_organization(auth.uid())
      OR has_role(auth.uid(), 'admin'::app_role)
      OR is_pubdigital_user(auth.uid())
    );
END $$;

-- Criar índice GIN para busca eficiente em message_variations (se houver muitos templates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'broadcast_campaign_templates'
      AND indexname = 'idx_broadcast_campaign_templates_message_variations'
  ) THEN
    CREATE INDEX idx_broadcast_campaign_templates_message_variations
    ON public.broadcast_campaign_templates
    USING GIN (message_variations);
  END IF;
END $$;
```

3. **Clique em "Run" ou pressione Ctrl+Enter**

4. **Verifique se executou com sucesso** - deve aparecer "Success. No rows returned"

---

## ✅ O que esta migration faz:

1. ✅ Garante que a coluna `message_variations` existe como JSONB
2. ✅ Garante que a coluna permite NULL (compatibilidade)
3. ✅ Corrige a política RLS de INSERT para incluir super admins
4. ✅ Cria índice GIN para busca eficiente

---

## 🔍 Após aplicar:

Teste criar um novo template de campanha. O erro 400 deve estar resolvido!


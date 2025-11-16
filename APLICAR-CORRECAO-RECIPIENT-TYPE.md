# 🔧 Correção: Coluna recipient_type não encontrada

## ❌ Erro
```
Could not find the 'recipient_type' column of 'whatsapp_workflows' in the schema cache
```

## ✅ Solução

Execute o SQL abaixo no **Supabase Dashboard**:

### Passo 1: Acessar SQL Editor
1. Acesse: https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/sql/new
2. Ou: Dashboard → SQL Editor → New query

### Passo 2: Copiar e Executar o SQL

Abra o arquivo `fix-recipient-type.sql` e copie TODO o conteúdo, depois cole no SQL Editor e clique em **RUN**.

**OU** copie este SQL diretamente:

```sql
-- ============================================
-- CORREÇÃO: Adicionar coluna recipient_type
-- ============================================

-- Adicionar campo recipient_type (se não existir)
ALTER TABLE public.whatsapp_workflows
  ADD COLUMN IF NOT EXISTS recipient_type text DEFAULT 'list'
    CHECK (recipient_type IN ('list', 'single', 'group'));

-- Tornar NOT NULL após adicionar valores padrão
DO $$
BEGIN
  -- Primeiro, garantir que todos os registros tenham um valor
  UPDATE public.whatsapp_workflows
  SET recipient_type = CASE 
    WHEN recipient_mode = 'single' THEN 'single'
    ELSE 'list'
  END
  WHERE recipient_type IS NULL;
  
  -- Depois, tornar NOT NULL
  ALTER TABLE public.whatsapp_workflows
    ALTER COLUMN recipient_type SET NOT NULL,
    ALTER COLUMN recipient_type SET DEFAULT 'list';
END $$;

-- Adicionar campo group_id (se não existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_workflow_groups') THEN
    ALTER TABLE public.whatsapp_workflows
      ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.whatsapp_workflow_groups(id) ON DELETE SET NULL;
  ELSE
    -- Se a tabela não existir, criar coluna sem foreign key por enquanto
    ALTER TABLE public.whatsapp_workflows
      ADD COLUMN IF NOT EXISTS group_id uuid;
  END IF;
END $$;

-- Índice para busca por grupo
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_group
  ON public.whatsapp_workflows (group_id)
  WHERE group_id IS NOT NULL;

-- Índice para busca por tipo de destinatário
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_recipient_type
  ON public.whatsapp_workflows (recipient_type);

-- Comentários explicativos
COMMENT ON COLUMN public.whatsapp_workflows.recipient_type IS 
  'Tipo de destinatário: list (lista de contatos), single (contato único), group (grupo de WhatsApp)';
COMMENT ON COLUMN public.whatsapp_workflows.group_id IS 
  'ID do grupo de WhatsApp (quando recipient_type = group). Referência para whatsapp_workflow_groups.';
```

### Passo 3: Verificar

Após executar, verifique se funcionou:

1. **No SQL Editor**, execute:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'whatsapp_workflows' 
   AND column_name IN ('recipient_type', 'group_id');
   ```

2. **Deve retornar:**
   - `recipient_type` | `text`
   - `group_id` | `uuid`

### Passo 4: Testar

1. Recarregue a página do workflow no navegador (F5)
2. Tente criar um novo workflow
3. O erro não deve mais aparecer

## 🔍 Se ainda der erro

1. **Limpar cache do Supabase:**
   - Dashboard → Settings → API
   - Role: `service_role`
   - Copie a key novamente (isso força refresh do cache)

2. **Verificar se a tabela existe:**
   ```sql
   SELECT EXISTS (
     SELECT 1 FROM information_schema.tables 
     WHERE table_name = 'whatsapp_workflows'
   );
   ```

3. **Verificar permissões:**
   - Certifique-se de estar usando a role correta no SQL Editor

## ✅ Após aplicar

A página de workflows deve funcionar normalmente e você poderá:
- ✅ Criar workflows
- ✅ Gerar boletos
- ✅ Adicionar CPF/CNPJ quando necessário


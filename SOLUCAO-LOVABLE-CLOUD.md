# 🔧 Solução para Lovable Cloud - Erro recipient_type

## ❌ Problema
```
Could not find the 'recipient_type' column of 'whatsapp_workflows' in the schema cache
```

## ✅ Soluções Disponíveis

### **OPÇÃO 1: Aplicar Migração via Lovable (RECOMENDADO)**

O Lovable Cloud deve aplicar migrações automaticamente quando você faz commit/push.

1. **Verifique se a migração foi criada:**
   - Arquivo: `supabase/migrations/20251117000000_fix_recipient_type_column.sql`
   - Esta migração será aplicada automaticamente pelo Lovable

2. **Se não aplicar automaticamente:**
   - No painel do Lovable, procure por **Database** ou **Migrations**
   - Execute manualmente a migração `20251117000000_fix_recipient_type_column.sql`

3. **Ou faça commit e push:**
   ```powershell
   git add .
   git commit -m "Add migration for recipient_type column"
   git push
   ```
   O Lovable deve detectar e aplicar a migração.

---

### **OPÇÃO 2: Solução Temporária no Código**

Modifiquei o código para ser mais resiliente. Agora ele tenta usar `recipient_type`, mas se a coluna não existir, pode funcionar apenas com `recipient_mode`.

**⚠️ Nota:** Esta é uma solução temporária. A migração ainda precisa ser aplicada.

---

### **OPÇÃO 3: Acessar SQL Editor via Lovable**

1. No Lovable, procure por:
   - **Database** → **SQL Editor**
   - **Settings** → **Database** → **SQL Editor**
   - Ou qualquer opção que permita executar SQL

2. Execute este SQL:

```sql
ALTER TABLE public.whatsapp_workflows
  ADD COLUMN IF NOT EXISTS recipient_type text DEFAULT 'list'
    CHECK (recipient_type IN ('list', 'single', 'group'));

UPDATE public.whatsapp_workflows
SET recipient_type = CASE 
  WHEN recipient_mode = 'single' THEN 'single'
  ELSE 'list'
END
WHERE recipient_type IS NULL;

ALTER TABLE public.whatsapp_workflows
  ALTER COLUMN recipient_type SET NOT NULL,
  ALTER COLUMN recipient_type SET DEFAULT 'list';
```

---

### **OPÇÃO 4: Usar Página de Correção**

Criei uma página que ajuda a verificar o status:

1. Acesse: `http://localhost:8080/fix-recipient-type` (ou a porta que estiver usando)
2. Clique em "Verificar se a coluna existe"
3. Siga as instruções exibidas

---

## 🎯 Qual Solução Usar?

**Prioridade:**
1. ✅ **OPÇÃO 1** - Aplicar migração via Lovable (melhor)
2. ✅ **OPÇÃO 3** - SQL Editor via Lovable (se disponível)
3. ⚠️ **OPÇÃO 2** - Código temporário (já aplicado, mas não ideal)
4. ℹ️ **OPÇÃO 4** - Página de verificação (apenas para diagnóstico)

---

## 📝 Arquivos Criados

- ✅ `supabase/migrations/20251117000000_fix_recipient_type_column.sql` - Migração
- ✅ `src/pages/FixRecipientType.tsx` - Página de verificação
- ✅ Código modificado para ser mais resiliente

---

## 🔍 Como Verificar se Funcionou

Após aplicar a migração, teste:

1. Acesse a página de workflows
2. Clique em "Novo workflow"
3. Preencha o formulário
4. Tente salvar
5. **Não deve mais dar erro de coluna faltante**

---

## 💡 Dica

Se você conseguir acesso temporário ao Supabase Dashboard (mesmo que via Lovable), 
a forma mais rápida é executar o SQL diretamente no SQL Editor.


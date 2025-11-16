# 🚀 Como Aplicar Migração no Lovable Cloud

## ❌ Problema Atual
A coluna `recipient_type` não existe no banco, causando erro ao criar workflows.

## ✅ Soluções (Escolha uma)

### **SOLUÇÃO 1: Via Lovable Interface (Mais Fácil)**

1. **No Lovable:**
   - Procure por **"Database"** ou **"Migrations"** no menu
   - Ou vá em **Settings** → **Database**
   - Procure pela opção de executar SQL ou aplicar migrações

2. **Execute este SQL:**
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

### **SOLUÇÃO 2: Commit e Push (Automático)**

O Lovable pode aplicar migrações automaticamente quando você faz commit:

1. **Faça commit da migração:**
   ```powershell
   git add supabase/migrations/20251117000000_fix_recipient_type_column.sql
   git commit -m "Add recipient_type column migration"
   git push
   ```

2. **O Lovable deve:**
   - Detectar a nova migração
   - Aplicar automaticamente
   - Ou mostrar opção para aplicar manualmente

---

### **SOLUÇÃO 3: Via Supabase URL Direta (Se tiver acesso)**

Mesmo usando Lovable Cloud, você pode tentar acessar o Supabase diretamente:

1. **Tente acessar:**
   - https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/sql/new
   - Use suas credenciais do Lovable (se tiver)

2. **Execute o SQL da SOLUÇÃO 1**

---

### **SOLUÇÃO 4: Contatar Suporte Lovable**

Se nenhuma das opções acima funcionar:

1. Entre em contato com o suporte do Lovable
2. Peça para aplicar a migração: `20251117000000_fix_recipient_type_column.sql`
3. Ou peça acesso temporário ao SQL Editor

---

## 📋 Arquivo da Migração

A migração está em:
- `supabase/migrations/20251117000000_fix_recipient_type_column.sql`

Você pode copiar o conteúdo deste arquivo e executar onde conseguir acesso SQL.

---

## ✅ Verificar se Funcionou

Após aplicar, teste:

1. Acesse a página de workflows
2. Clique em "Novo workflow"
3. Preencha e salve
4. **Não deve mais dar erro!**

---

## 🔧 Solução Temporária (Já Aplicada)

Modifiquei o código para ser mais resiliente, mas **ainda é necessário aplicar a migração** para funcionar completamente.

A migração é **obrigatória** - o código sozinho não resolve o problema.


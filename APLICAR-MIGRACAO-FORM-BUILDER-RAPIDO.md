# ⚡ Aplicar Migração Form Builder - Guia Rápido

## 🚨 Erro: Tabela não encontrada
A tabela `form_builders` precisa ser criada no banco de dados.

## ✅ Solução Rápida (2 minutos)

### Passo 1: Acesse o Supabase Dashboard
1. Vá para: https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/sql/new
2. Faça login se necessário

### Passo 2: Cole e Execute o SQL
1. Abra o arquivo: `supabase/migrations/20250124000000_create_form_builders.sql`
2. **Copie TODO o conteúdo** (Ctrl+A, Ctrl+C)
3. Cole no SQL Editor do Supabase
4. Clique em **RUN** ou pressione **Ctrl+Enter**

### Passo 3: Verificar
1. Vá em **Table Editor** no menu lateral
2. Deve aparecer:
   - ✅ `form_builders`
   - ✅ `form_submissions`
3. Recarregue a página do Form Builder

## ✅ Pronto!
Agora você pode criar formulários sem erro.


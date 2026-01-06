# 🚀 Aplicar SQL de Correção - Asaas base_url

## ⚡ Método Rápido (Recomendado)

### 1. Acesse o Supabase SQL Editor:
👉 **https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new**

### 2. Cole o SQL completo:
Abra o arquivo `scripts/aplicar-fix-asaas-base-url.sql` e copie TODO o conteúdo.

### 3. Execute:
- Clique em **"Run"** ou pressione `Ctrl+Enter`
- Aguarde a confirmação de sucesso
- Verifique se apareceu: `✅ RLS está habilitado e seguro`

### 4. Pronto!
A coluna `base_url` foi adicionada e todas as políticas de segurança foram configuradas.

---

## 📋 O que o SQL faz:

✅ Adiciona coluna `base_url` em `asaas_configs`  
✅ Cria tabela se não existir  
✅ Habilita RLS (Row Level Security)  
✅ Cria políticas de segurança completas (SELECT, INSERT, UPDATE, DELETE)  
✅ Cria funções de segurança (`is_pubdigital_user`, `user_is_org_admin`)  
✅ Verifica que RLS está ativo  

---

## 🔒 Segurança Garantida:

- ✅ Cada organização vê apenas suas próprias configurações
- ✅ Apenas membros autorizados podem modificar
- ✅ API keys protegidas por RLS
- ✅ Super admins (pubdigital) têm acesso total

---

## ⚠️ Se der erro:

1. Verifique se está logado no Supabase
2. Verifique se tem permissões de admin no projeto
3. Execute o SQL em partes (separe por seções)
4. Verifique os logs de erro no Supabase

---

**Arquivo SQL:** `scripts/aplicar-fix-asaas-base-url.sql`


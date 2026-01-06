# 🔧 Correção Completa: Todos os Erros de Workflows

## 📋 Problemas Identificados

1. ❌ Tabela `whatsapp_workflows` não encontrada (404)
2. ❌ Tabela `whatsapp_workflow_approvals` não encontrada (404)
3. ❌ Tabela `whatsapp_boletos` não encontrada (404)
4. ❌ Coluna `base_url` não existe em `asaas_configs` (400)
5. ❌ Função `is_pubdigital_user` não encontrada (400)
6. ❌ Integração Asaas aparece como "não configurada" mesmo quando está

## ✅ Solução

### Passo 1: Aplicar SQL de Correção

1. **Acesse o Supabase SQL Editor:**
   👉 **https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new**

2. **Cole o SQL completo:**
   Abra o arquivo `scripts/corrigir-todos-erros-workflows.sql` e copie TODO o conteúdo.

3. **Execute:**
   - Clique em **"Run"** ou pressione `Ctrl+Enter`
   - Aguarde a confirmação de sucesso
   - Verifique se apareceu: `✅ Todas as verificações passaram!`

### Passo 2: Aguardar Atualização do Schema Cache

Após aplicar o SQL:
- ⏱️ Aguarde **30-60 segundos** para o schema cache do Supabase atualizar
- 🔄 Recarregue a página do navegador (F5 ou Ctrl+R)
- 🔄 Se necessário, limpe o cache (Ctrl+Shift+R ou Cmd+Shift+R)

### Passo 3: Verificar

Após aguardar e recarregar:
- ✅ Erros 404 devem desaparecer
- ✅ Erro 400 do Asaas deve desaparecer
- ✅ Integração Asaas deve ser detectada corretamente

## 📄 O Que o SQL Faz

✅ **Cria todas as tabelas necessárias:**
- `whatsapp_workflows`
- `whatsapp_workflow_approvals`
- `whatsapp_boletos`
- `whatsapp_workflow_lists` (se não existir)

✅ **Adiciona coluna `base_url` em `asaas_configs`**

✅ **Cria funções de segurança:**
- `is_pubdigital_user()`
- `user_is_org_admin()`
- `user_belongs_to_org()`

✅ **Configura políticas RLS completas:**
- SELECT, INSERT, UPDATE, DELETE para todas as tabelas
- Verificação de pertencimento à organização
- Suporte para admins e super admins

✅ **Força atualização do schema cache:**
- Notifica PostgREST para recarregar schema
- Aguarda 1 segundo para garantir atualização

✅ **Verifica tudo:**
- Confirma que todas as tabelas foram criadas
- Confirma que todas as colunas existem
- Confirma que todas as funções foram criadas

## 🔒 Segurança

Todas as políticas RLS foram configuradas com:
- ✅ Verificação de pertencimento à organização
- ✅ Suporte para admins da organização
- ✅ Suporte para super admins (pubdigital)
- ✅ Proteção contra acesso não autorizado

## ⚠️ Importante

- **NÃO precisa fazer deploy** após aplicar o SQL
- O código frontend já está preparado para usar todas as tabelas e colunas
- Apenas aguarde o schema cache atualizar e recarregue a página

## 🐛 Se Ainda Houver Erros

1. **Aguarde mais tempo** (schema cache pode levar até 2 minutos)
2. **Limpe o cache do navegador** completamente
3. **Verifique no Supabase SQL Editor** se as tabelas foram criadas:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('whatsapp_workflows', 'whatsapp_workflow_approvals', 'whatsapp_boletos');
   ```
4. **Verifique se a coluna base_url existe:**
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_schema = 'public' 
   AND table_name = 'asaas_configs' 
   AND column_name = 'base_url';
   ```


# 🚀 Deploy DeepSeek - Ambiente de Produção

**Data:** 15/12/2025  
**Status:** ✅ Pronto para deploy

---

## 📋 Checklist Pré-Deploy

Antes de fazer o deploy, verifique:

- [x] ✅ Correções de segurança aplicadas
- [x] ✅ Melhorias de UX implementadas
- [x] ✅ Validações adicionadas
- [x] ✅ Sem erros de lint
- [x] ✅ Código testado localmente

---

## 🔧 Passo 1: Aplicar Migrations

### 1.1 Migration: Adicionar campo api_key

**Arquivo:** `supabase/migrations/20251215000000_add_api_key_to_assistant_config.sql`

**Opção A - Via Supabase Dashboard (Recomendado):**
1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **SQL Editor**
4. Abra o arquivo: `supabase/migrations/20251215000000_add_api_key_to_assistant_config.sql`
5. Copie TODO o conteúdo
6. Cole no SQL Editor
7. Clique em **Run** ou **Execute**

**Opção B - Via Supabase CLI:**
```bash
cd /root/kanban-buzz-95241
supabase db push
```

**Verificar se funcionou:**
```sql
-- Execute no SQL Editor
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'assistant_config' 
AND column_name = 'api_key';
```
Deve retornar uma linha com `api_key` do tipo `text`.

---

## 🔧 Passo 2: Configurar API Key do DeepSeek

### 2.1 Via SQL (Recomendado)

**Arquivo:** `supabase/fixes/20251215_CONFIGURAR_DEEPSEEK_API_KEY.sql`

1. Acesse: **SQL Editor** no Supabase Dashboard
2. Abra o arquivo: `supabase/fixes/20251215_CONFIGURAR_DEEPSEEK_API_KEY.sql`
3. Copie TODO o conteúdo
4. Cole no SQL Editor
5. **IMPORTANTE:** O script já está configurado para criar a tabela e configurar a API key global
6. Clique em **Run**

**Verificar se funcionou:**
```sql
SELECT 
  id,
  organization_id,
  CASE 
    WHEN api_key IS NOT NULL THEN '✅ Configurada'
    ELSE '❌ Não configurada'
  END as status,
  is_global,
  created_at
FROM assistant_config
WHERE api_key IS NOT NULL;
```

Deve retornar pelo menos uma linha com `is_global = true` e `status = '✅ Configurada'`.

### 2.2 Via Interface (Alternativa)

1. Acesse a página de **Super Admin** → **Configurações do Assistente**
2. Vá na aba **Avançado**
3. No campo **API Key do DeepSeek**, insira: `sk-ed9d35a520ef4cf4bb056cd51d839651`
4. Clique em **Salvar Configuração**

---

## 🔧 Passo 3: Deploy da Edge Function

### 3.1 Via Supabase Dashboard (Recomendado)

1. **Acesse o Supabase Dashboard:**
   - URL: https://supabase.com/dashboard
   - Faça login e selecione seu projeto

2. **Vá em Edge Functions:**
   - Menu lateral esquerdo → **Edge Functions**

3. **Encontre a função `deepseek-assistant`:**
   - Se a função já existe, clique nela para editar
   - Se não existe, clique em **Create a new function** e nomeie como `deepseek-assistant`

4. **Copiar o código atualizado:**
   - Abra o arquivo: `supabase/functions/deepseek-assistant/index.ts`
   - **Copie TODO o conteúdo** (Ctrl+A, Ctrl+C ou Cmd+A, Cmd+C)

5. **Colar no editor do Dashboard:**
   - Cole o código no editor da função
   - **Substitua todo o conteúdo antigo**

6. **Salvar/Deploy:**
   - Clique em **Deploy** ou **Save**
   - Aguarde a confirmação (pode levar 1-2 minutos)

### 3.2 Via Supabase CLI (Alternativa)

```bash
cd /root/kanban-buzz-95241

# Fazer login (se necessário)
supabase login

# Linkar ao projeto (se necessário)
supabase link --project-ref SEU_PROJECT_REF

# Deploy da função
supabase functions deploy deepseek-assistant
```

**Verificar se funcionou:**
- No Dashboard, vá em **Edge Functions**
- Deve aparecer `deepseek-assistant` na lista
- Status deve ser **Active** (verde)

---

## 🔧 Passo 4: Verificar Configuração

### 4.1 Verificar Edge Function

1. No Dashboard, vá em **Edge Functions**
2. Clique em `deepseek-assistant`
3. Verifique:
   - ✅ Status: **Active**
   - ✅ **verify_jwt**: `true` (deve estar habilitado)
   - ✅ Última atualização: Data/hora recente

### 4.2 Verificar API Key

```sql
-- Execute no SQL Editor
SELECT 
  CASE 
    WHEN api_key IS NOT NULL THEN '✅ API Key configurada'
    ELSE '❌ API Key não configurada'
  END as status,
  is_global,
  model,
  is_active
FROM assistant_config
WHERE api_key IS NOT NULL
ORDER BY updated_at DESC
LIMIT 1;
```

**Resultado esperado:**
- `status`: ✅ API Key configurada
- `is_global`: `true`
- `is_active`: `true`

### 4.3 Verificar Tabelas

```sql
-- Verificar se todas as tabelas existem
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'assistant_config',
  'assistant_conversations',
  'assistant_actions'
)
ORDER BY table_name;
```

**Resultado esperado:** 3 linhas (uma para cada tabela)

---

## 🧪 Passo 5: Testar no Ambiente Real

### 5.1 Teste Básico

1. **Acesse a aplicação:**
   - Faça login
   - Vá para a página do **Assistente IA**

2. **Teste criar um lead:**
   - Digite: "Criar um lead chamado Teste Deploy, telefone 11999999999"
   - Pressione Enter ou clique em Enviar
   - **Resultado esperado:** Lead criado com sucesso

3. **Verificar feedback visual:**
   - Deve aparecer "Processando sua solicitação..."
   - Deve aparecer badge verde "Lead criado com sucesso"
   - Deve aparecer toast de notificação

### 5.2 Teste de Validação

1. **Teste com dados inválidos:**
   - Digite: "Criar um lead chamado A, telefone 123"
   - **Resultado esperado:** Erro com mensagem clara e sugestões

2. **Teste buscar leads:**
   - Digite: "Buscar leads com nome Teste"
   - **Resultado esperado:** Lista de leads encontrados

### 5.3 Teste de Funcionalidades

Teste cada função disponível:
- ✅ Criar lead
- ✅ Buscar leads
- ✅ Atualizar lead
- ✅ Listar etapas
- ✅ Listar tags
- ✅ Adicionar tag
- ✅ Agendar ligação
- ✅ Enviar WhatsApp
- ✅ Estatísticas
- ✅ Detalhes do lead

---

## ✅ Checklist Pós-Deploy

Após o deploy, verifique:

- [ ] Migration aplicada com sucesso
- [ ] API Key configurada no banco
- [ ] Edge function deployada e ativa
- [ ] Teste básico funcionando
- [ ] Validações funcionando
- [ ] Feedback visual aparecendo
- [ ] Mensagens de erro melhoradas
- [ ] Botão copiar funcionando
- [ ] Toast de notificações aparecendo

---

## 🔍 Troubleshooting

### Problema: "API Key não configurada"

**Solução:**
1. Verifique se executou o script de configuração
2. Verifique se a API key está no banco:
```sql
SELECT api_key IS NOT NULL as has_key FROM assistant_config WHERE is_global = true;
```
3. Se não estiver, execute novamente o script de configuração

### Problema: "Função não encontrada"

**Solução:**
1. Verifique se a função foi deployada:
   - Dashboard → Edge Functions → Verificar se `deepseek-assistant` está na lista
2. Se não estiver, faça o deploy novamente

### Problema: "Erro 401 - Token inválido"

**Solução:**
1. Verifique se está logado
2. Verifique se a função tem `verify_jwt = true` no config.toml
3. Tente fazer logout e login novamente

### Problema: "Organização não encontrada"

**Solução:**
1. Verifique se o usuário está associado a uma organização
2. Verifique se está usando a organização correta
3. Verifique os logs da edge function no Dashboard

---

## 📊 Verificação Final

Execute este script SQL para verificar tudo:

```sql
-- Verificação completa
SELECT 
  'Tabelas' as categoria,
  COUNT(*) as total,
  CASE 
    WHEN COUNT(*) = 3 THEN '✅ OK'
    ELSE '❌ Faltando tabelas'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('assistant_config', 'assistant_conversations', 'assistant_actions')

UNION ALL

SELECT 
  'API Key' as categoria,
  COUNT(*) as total,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Configurada'
    ELSE '❌ Não configurada'
  END as status
FROM assistant_config
WHERE api_key IS NOT NULL

UNION ALL

SELECT 
  'Campo api_key' as categoria,
  COUNT(*) as total,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Existe'
    ELSE '❌ Não existe'
  END as status
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'assistant_config'
AND column_name = 'api_key';
```

**Resultado esperado:**
- Tabelas: ✅ OK (3)
- API Key: ✅ Configurada (1 ou mais)
- Campo api_key: ✅ Existe (1)

---

## 🎉 Deploy Concluído!

Se todos os testes passaram, o deploy foi bem-sucedido! 

**Próximos passos:**
1. Monitorar uso e erros
2. Coletar feedback dos usuários
3. Implementar melhorias adicionais conforme necessário

---

## 📝 Resumo das Mudanças

### Backend (Edge Function)
- ✅ Validações robustas em todas as funções
- ✅ Validação de organização
- ✅ Sanitização de erros
- ✅ Remoção de logs sensíveis
- ✅ Validação de tamanho de mensagem

### Frontend (Interface)
- ✅ Feedback visual durante ações
- ✅ Botões de ação (copiar)
- ✅ Confirmações visuais
- ✅ Mensagens de erro melhoradas
- ✅ Loading state melhorado
- ✅ Quick actions melhoradas

### Banco de Dados
- ✅ Campo `api_key` adicionado
- ✅ Tabela `assistant_config` criada (se não existia)
- ✅ API key configurada

---

**Status:** ✅ Pronto para produção




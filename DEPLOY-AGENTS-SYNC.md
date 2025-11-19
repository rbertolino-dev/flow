# 🚀 Deploy das Edge Functions - Agents Sync

## ⚠️ IMPORTANTE: Deploy das funções atualizadas

As seguintes funções foram corrigidas e precisam ser atualizadas no Supabase:

1. **agents-sync-openai** - Corrigido `response_format` hardcoded
2. **agents-sync-evolution** - Já atualizada anteriormente

---

## 📋 Método 1: Via Lovable Cloud (Recomendado para Lovable)

### 🎯 Como fazer deploy no Lovable Cloud:

1. **No Lovable Cloud:**
   - Procure por **"Edge Functions"** ou **"Supabase Functions"** no menu
   - Ou vá em **Settings** → **Supabase** → **Edge Functions**
   - Ou procure por **"Functions"** na barra lateral

2. **Encontre ou crie a função `agents-sync-openai`:**
   - Se a função já existe, clique nela para editar
   - Se não existe, clique em **"Create Function"** ou **"New Function"**
   - Nome da função: `agents-sync-openai`

3. **Copiar o código atualizado:**
   - Abra o arquivo: `supabase/functions/agents-sync-openai/index.ts`
   - **Copie TODO o conteúdo** (Ctrl+A, Ctrl+C)

4. **Colar no editor do Lovable:**
   - Cole o código no editor da função
   - Substitua todo o conteúdo antigo

5. **Salvar/Deploy:**
   - Clique em **"Save"** ou **"Deploy"** ou **"Update"**
   - Aguarde a confirmação

6. **Repetir para `agents-sync-evolution`** (se necessário)

---

## 📋 Método 2: Via Supabase Dashboard (Se tiver acesso)

### 1️⃣ Deploy da função `agents-sync-openai`

1. **Acesse o Supabase Dashboard:**
   - URL: https://supabase.com/dashboard
   - Faça login e selecione seu projeto

2. **Vá em Edge Functions:**
   - Menu lateral esquerdo → **Edge Functions**

3. **Encontre ou crie a função:**
   - Se a função `agents-sync-openai` já existe, clique nela
   - Se não existe, clique em **Create a new function** e nomeie como `agents-sync-openai`

4. **Copiar o código atualizado:**
   - Abra o arquivo: `supabase/functions/agents-sync-openai/index.ts`
   - **Copie TODO o conteúdo** do arquivo (Ctrl+A, Ctrl+C)

5. **Colar no Dashboard:**
   - Cole o código no editor da função no Dashboard
   - Substitua todo o conteúdo antigo

6. **Fazer Deploy:**
   - Clique no botão **Deploy** (ou **Save & Deploy**)
   - Aguarde a confirmação de sucesso

7. **Verificar:**
   - A função deve aparecer com status "Active"
   - Você pode testar clicando em **Invoke** (opcional)

---

### 2️⃣ Verificar a função `agents-sync-evolution`

1. **No Dashboard, vá em Edge Functions**
2. **Encontre a função `agents-sync-evolution`**
3. **Verifique se está atualizada** (deve ter os campos `response_format` e `split_messages`)
4. **Se necessário, atualize seguindo os mesmos passos acima**

---

## ✅ Verificação após Deploy

### Testar a função `agents-sync-openai`:

1. No Dashboard, clique na função `agents-sync-openai`
2. Clique em **Invoke**
3. Use este payload de teste:
   ```json
   {
     "agent_id": "seu-agent-id-aqui"
   }
   ```
4. Verifique os logs para confirmar que:
   - O `response_format` está sendo lido do banco de dados
   - O mapeamento está correto (text → omitido/null, json → { type: "json_object" })

---

## 🔍 O que foi corrigido:

### `agents-sync-openai`:
- ❌ **Antes:** `response_format` estava hardcoded como `{ type: "json_object" }`
- ✅ **Agora:** Usa o valor do banco de dados (`agent.response_format`)
- ✅ **Mapeamento:**
  - Se `response_format = 'text'`: campo omitido (ou `null` para atualizar assistentes existentes)
  - Se `response_format = 'json'`: envia `{ type: "json_object" }`
- ✅ Instruções JSON só são adicionadas se `response_format = 'json'`

### `agents-sync-evolution`:
- ✅ Campos `response_format` e `split_messages` incluídos no payload
- ✅ Validação e logs detalhados

---

## 📝 Notas Importantes:

1. **Após o deploy**, os assistentes existentes precisarão ser **sincronizados novamente** para aplicar as correções
2. **Novos assistentes** já usarão a configuração correta automaticamente
3. **Verifique os logs** da Edge Function após sincronizar um agente para confirmar que está funcionando

---

## 🆘 Problemas?

Se encontrar erros durante o deploy:

1. Verifique se copiou **TODO o conteúdo** do arquivo
2. Verifique se não há erros de sintaxe no editor
3. Consulte os logs da função no Dashboard
4. Verifique se as variáveis de ambiente estão configuradas corretamente


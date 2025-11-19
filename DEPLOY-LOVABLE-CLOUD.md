# 🚀 Deploy via Lovable Cloud - Edge Functions

## ⚠️ IMPORTANTE: Instruções específicas para Lovable Cloud

Como você está usando Lovable Cloud e não tem acesso direto ao Supabase Dashboard, siga estas instruções:

---

## 📋 Funções que precisam ser atualizadas:

1. **agents-sync-openai** - Corrigido `response_format` hardcoded
2. **agents-sync-evolution** - Já atualizada (verificar se precisa atualizar)

---

## 🎯 Passo a Passo no Lovable Cloud:

### 1️⃣ Localizar Edge Functions no Lovable

**Opções para encontrar:**

1. **Menu Lateral:**
   - Procure por **"Functions"** ou **"Edge Functions"**
   - Ou **"Supabase"** → **"Functions"**

2. **Settings/Configurações:**
   - Vá em **Settings** → **Supabase** → **Edge Functions**
   - Ou **Settings** → **Database** → **Functions**

3. **Busca:**
   - Use a busca do Lovable e procure por "edge functions" ou "supabase functions"

---

### 2️⃣ Atualizar a função `agents-sync-openai`

1. **Encontre a função:**
   - Procure por `agents-sync-openai` na lista de funções
   - Se não existir, clique em **"Create Function"** ou **"New Function"**

2. **Copiar código:**
   - Abra: `supabase/functions/agents-sync-openai/index.ts`
   - **Selecione TODO** (Ctrl+A)
   - **Copie** (Ctrl+C)

3. **Colar no Lovable:**
   - No editor da função no Lovable
   - **Selecione TODO** o conteúdo antigo (Ctrl+A)
   - **Cole** o novo código (Ctrl+V)

4. **Salvar:**
   - Clique em **"Save"**, **"Deploy"**, **"Update"** ou **"Publish"**
   - Aguarde confirmação

---

### 3️⃣ Verificar a função `agents-sync-evolution`

1. **Encontre a função `agents-sync-evolution`**
2. **Verifique se tem os campos:**
   - `response_format` (linha ~31)
   - `split_messages` (linha ~32)
3. **Se não tiver, atualize seguindo os passos acima**

---

## 🔍 Como verificar se está correto:

### Para `agents-sync-openai`:

Procure por estas linhas no código:

```typescript
// VALIDAÇÃO E MAPEAMENTO DO response_format
const responseFormat = (agent.response_format === 'text' || agent.response_format === 'json') 
  ? agent.response_format 
  : 'text'; // Padrão sempre 'text'
```

E mais abaixo:

```typescript
// Incluir response_format APENAS se for JSON
if (responseFormat === 'json') {
  assistantPayload.response_format = { type: "json_object" };
} else {
  if (agent.openai_assistant_id) {
    assistantPayload.response_format = null;
  }
}
```

**❌ NÃO deve ter:**
```typescript
response_format: { type: "json_object" }, // ❌ ERRADO - hardcoded
```

---

## 📝 Arquivos para copiar:

1. **agents-sync-openai:**
   - Arquivo: `supabase/functions/agents-sync-openai/index.ts`
   - Tamanho: ~304 linhas

2. **agents-sync-evolution:**
   - Arquivo: `supabase/functions/agents-sync-evolution/index.ts`
   - Verificar se tem `response_format` e `split_messages`

---

## ✅ Após o Deploy:

1. **Teste sincronizando um agente:**
   - Vá na página de Agentes
   - Clique em "Sincronizar com OpenAI" em um agente
   - Verifique os logs (se disponível no Lovable)

2. **Verifique no painel OpenAI:**
   - O assistente deve ter "Response format" como "Text" (se configurado como texto)
   - Não deve mais estar hardcoded como "json_object"

---

## 🆘 Se não encontrar Edge Functions no Lovable:

1. **Tente acessar via URL direta:**
   - O Lovable pode ter um link direto para Supabase
   - Procure por links no menu ou settings

2. **Contatar suporte Lovable:**
   - Peça ajuda para acessar Edge Functions
   - Ou peça para atualizar as funções manualmente

3. **Alternativa - Commit e Push:**
   - O Lovable pode fazer deploy automático ao fazer commit
   - Já fizemos commit, então pode estar automático
   - Verifique se as funções foram atualizadas automaticamente

---

## 📋 Resumo do que foi corrigido:

- ❌ **Antes:** `response_format` hardcoded como `{ type: "json_object" }`
- ✅ **Agora:** Usa valor do banco de dados (`agent.response_format`)
- ✅ **Mapeamento:** text → omitido/null, json → json_object
- ✅ **Instruções JSON:** Só adicionadas se `response_format = 'json'`


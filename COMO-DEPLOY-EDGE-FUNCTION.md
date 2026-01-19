# 🚀 Como Fazer Deploy da Edge Function

## 📋 Deploy da função `process-scheduled-messages`

### Opção 1: Via Supabase Dashboard (Recomendado - Mais Fácil)

1. **Acesse o Supabase Dashboard:**
   - URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog
   - Faça login

2. **Vá em Edge Functions:**
   - Menu lateral esquerdo → **Edge Functions**

3. **Encontre a função `process-scheduled-messages`:**
   - Procure na lista de funções
   - Clique na função para editar

4. **Atualizar o código:**
   - Abra o arquivo: `supabase/functions/process-scheduled-messages/index.ts`
   - **Copie TODO o conteúdo** (Ctrl+A, Ctrl+C)
   - No Dashboard, **substitua TODO o conteúdo** antigo (Ctrl+A, Ctrl+V)
   - Clique em **Deploy** ou **Save**

5. **Aguardar confirmação:**
   - O deploy leva alguns segundos
   - Você verá uma mensagem de sucesso

---

### Opção 2: Via Supabase CLI (Se tiver instalado)

**Verificar se CLI está instalado:**
```bash
supabase --version
```

**Se não estiver instalado, instalar:**
```bash
# Via npm
npm install -g supabase

# Ou via Homebrew (Mac/Linux)
brew install supabase/tap/supabase
```

**Fazer login:**
```bash
supabase login
```

**Linkar ao projeto:**
```bash
cd /root/kanban-buzz-95241
supabase link --project-ref ogeljmbhqxpfjbpnbwog
```

**Fazer deploy:**
```bash
supabase functions deploy process-scheduled-messages
```

---

## ✅ Verificação após Deploy

### 1. Verificar no Dashboard:
- Vá em **Edge Functions**
- Verifique se `process-scheduled-messages` aparece na lista
- Clique na função e veja a data/hora do último deploy

### 2. Testar a função:
- No Dashboard, clique em **Invoke** na função
- Veja os logs em tempo real
- Verifique se não há erros

### 3. Verificar logs:
- Vá em **Logs** na função
- Procure por mensagens de erro ou sucesso
- Os logs detalhados que adicionamos devem aparecer

---

## 🔍 O que foi corrigido na função

1. **Logs detalhados** para debug
2. **Correção da formatação de telefone** - adiciona código do país `55` automaticamente
3. **Fallback de segurança** - garante que números brasileiros sempre tenham `55`
4. **Melhor tratamento de erros** - mensagens mais claras

---

## 📝 Notas Importantes

- O deploy é **instantâneo** - não precisa reiniciar nada
- A função é chamada automaticamente pelo **cron job** a cada minuto
- Você pode testar manualmente clicando em **Invoke** no Dashboard
- Os logs aparecem em tempo real na aba **Logs**

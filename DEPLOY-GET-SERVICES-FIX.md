# 🚀 Deploy da Edge Function `get-services` - Correção CORS

## ⚠️ IMPORTANTE: Redeploy Necessário

A edge function `get-services` foi corrigida para permitir requisições DELETE, mas **precisa ser redeployada no Supabase** para que a correção entre em vigor.

---

## 📋 Como Fazer o Deploy:

### Método 1: Via Supabase Dashboard (Recomendado)

1. **Acesse o Supabase Dashboard:**
   - URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog
   - Faça login

2. **Vá em Edge Functions:**
   - Menu lateral esquerdo → **Edge Functions**

3. **Encontre a função `get-services`:**
   - Procure na lista de funções
   - Clique na função para editar

4. **Atualizar o código:**
   - Abra o arquivo: `supabase/functions/get-services/index.ts`
   - **Copie TODO o conteúdo** (Ctrl+A, Ctrl+C)
   - No Dashboard, **substitua TODO o conteúdo** antigo (Ctrl+A, Ctrl+V)
   - **IMPORTANTE**: Verifique que a linha 8 contém:
     ```typescript
     'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS, PATCH',
     ```
   - Clique em **Deploy** ou **Save**

5. **Aguardar confirmação:**
   - O deploy leva alguns segundos
   - Você verá uma mensagem de sucesso

---

### Método 2: Via Supabase CLI (Se tiver instalado)

```bash
# Fazer login (se necessário)
supabase login

# Linkar ao projeto (se necessário)
cd /root/kanban-buzz-95241
supabase link --project-ref ogeljmbhqxpfjbpnbwog

# Deploy da função
supabase functions deploy get-services
```

---

## ✅ Verificação após Deploy

### 1. Verificar no Dashboard:
- Vá em **Edge Functions**
- Verifique se `get-services` aparece na lista
- Clique na função e veja a data/hora do último deploy
- Deve mostrar a data/hora atual

### 2. Testar a função:
- Tente deletar um serviço na aplicação
- O erro de CORS não deve mais aparecer
- O serviço deve ser deletado com sucesso

### 3. Verificar logs:
- No Dashboard, vá em **Logs** na função `get-services`
- Procure por requisições DELETE
- Verifique se não há erros de CORS

---

## 🔍 O que foi corrigido:

1. **CORS Headers**: Adicionado `DELETE` ao `Access-Control-Allow-Methods`
2. **OPTIONS Handler**: Já estava correto, retornando headers CORS para preflight
3. **DELETE Handler**: Já estava implementado corretamente

---

## ⚠️ Nota Importante:

Se após o deploy o erro de CORS ainda persistir:

1. **Limpar cache do navegador:**
   - Pressione `Ctrl+Shift+R` (Windows/Linux) ou `Cmd+Shift+R` (Mac)
   - Ou limpe o cache manualmente

2. **Verificar se o deploy foi bem-sucedido:**
   - No Dashboard, confirme que a data/hora do último deploy é recente
   - Verifique se não há erros no deploy

3. **Verificar se a função está ativa:**
   - No Dashboard, confirme que a função está com status "Active"

---

## 📝 Arquivo Corrigido:

- `supabase/functions/get-services/index.ts`
- Linha 8: `'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS, PATCH',`

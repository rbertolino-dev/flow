# 🔧 Correção: Erro ao Enviar Contrato via WhatsApp

## ❌ Problema

Ao tentar enviar um contrato via WhatsApp, aparece o erro:

```
POST https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/send-contract-signed net::ERR_FAILED
Erro de conexão: Failed to fetch
```

## 🔍 Causa

O erro `ERR_FAILED` geralmente indica que:

1. **A Edge Function `send-contract-signed` não está deployada** no Supabase
2. A Edge Function está crashando antes de retornar resposta
3. Problema de timeout ou conexão

## ✅ Solução

### Método 1: Deploy via Script (Recomendado)

Execute o script de deploy:

```bash
cd /root/kanban-buzz-95241
./scripts/deploy-send-contract-signed.sh
```

**Se o script não funcionar** (Supabase CLI não instalado), use o Método 2.

---

### Método 2: Deploy Manual via Dashboard (Mais Simples)

1. **Acesse o Supabase Dashboard:**
   - URL: https://supabase.com/dashboard
   - Faça login e selecione seu projeto

2. **Vá em Edge Functions:**
   - Menu lateral esquerdo → **Edge Functions**

3. **Encontre ou crie a função:**
   - Se a função `send-contract-signed` já existe, clique nela para editar
   - Se não existe, clique em **Create a new function** e nomeie como `send-contract-signed`

4. **Copiar o código atualizado:**
   - Abra o arquivo: `supabase/functions/send-contract-signed/index.ts`
   - **Copie TODO o conteúdo** (Ctrl+A, Ctrl+C)

5. **Colar no Dashboard:**
   - No editor da função no Dashboard
   - **Selecione TODO** o conteúdo antigo (Ctrl+A)
   - **Cole** o novo código (Ctrl+V)

6. **Fazer deploy:**
   - Clique em **Deploy** ou **Save**
   - Aguarde a confirmação

7. **Verificar se funcionou:**
   - A função deve aparecer na lista com status "Active"
   - Clique na função → **Logs** para ver os logs em tempo real

---

## 🔍 Verificação

Após fazer o deploy, teste novamente:

1. Tente enviar um contrato via WhatsApp
2. Se ainda der erro, verifique os logs:
   - No Dashboard → Edge Functions → `send-contract-signed` → **Logs**
   - Os logs mostrarão exatamente onde está falhando

---

## 📋 Melhorias Implementadas

### 1. Logs Detalhados na Edge Function

A Edge Function agora tem logs em cada etapa:
- ✅ Recebimento da requisição
- ✅ Parse do JSON
- ✅ Validação de parâmetros
- ✅ Busca da configuração Evolution
- ✅ Envio para Evolution API
- ✅ Resposta da Evolution API

### 2. Tratamento de Erros Melhorado no Frontend

O frontend agora mostra mensagens mais específicas:
- ✅ "Não foi possível conectar ao servidor" → Indica que a função não está deployada
- ✅ "Erro de CORS" → Problema de configuração
- ✅ "Tempo limite excedido" → Timeout

### 3. Validação de Variáveis de Ambiente

A Edge Function agora valida se as variáveis de ambiente estão configuradas antes de executar.

---

## 🚨 Se Ainda Não Funcionar

1. **Verifique os logs da Edge Function:**
   - Dashboard → Edge Functions → `send-contract-signed` → **Logs**
   - Procure por erros em vermelho

2. **Verifique se a instância do WhatsApp está conectada:**
   - No sistema, vá em **Configurações** → **Evolution API**
   - Verifique se a instância está com status "Conectado"

3. **Verifique se o telefone do cliente está correto:**
   - O telefone deve estar no formato correto (com DDI)
   - Exemplo: `5511999999999` (Brasil)

4. **Verifique se o PDF do contrato existe:**
   - O contrato deve ter um PDF gerado
   - Verifique se `contract.pdf_url` ou `contract.signed_pdf_url` existe

---

## 📝 Notas

- A Edge Function precisa ser deployada **após cada atualização** do código
- Os logs ajudam a identificar exatamente onde está o problema
- O erro `ERR_FAILED` geralmente significa que a função não está deployada ou está crashando

---

## ✅ Próximos Passos

1. Fazer deploy da Edge Function (Método 1 ou 2 acima)
2. Testar envio de contrato via WhatsApp
3. Verificar logs se ainda houver erro
4. Reportar o erro específico se persistir


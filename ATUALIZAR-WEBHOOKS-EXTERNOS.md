# 🔗 Atualizar Webhooks Externos

**Status**: ⏳ **Pendente**  
**Tempo estimado**: 10-15 minutos

---

## ✅ O Que Foi Concluído

- ✅ Migrations: 210/220 (95%)
- ✅ Edge Functions: 85/85 (100%)
- ✅ Secrets: 8/8 (100%)
- ✅ Frontend (.env): 3/3 (100%)
- ✅ Cron Jobs: 7/7 (100%) - **FUNCIONANDO!**

---

## 🎯 Próximo Passo: Atualizar Webhooks Externos

Agora que os cron jobs estão funcionando, é necessário atualizar os webhooks externos para apontar para o novo projeto Supabase.

---

## 📋 Webhooks que Precisam ser Atualizados

### 1. Evolution API Webhooks

**URL do Webhook:**
```
https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/evolution-webhook
```

**Como Atualizar:**
1. Acesse cada instância do Evolution API
2. Vá em **Settings** → **Webhooks**
3. Atualize a URL do webhook para a URL acima
4. Configure os eventos necessários:
   - `messages.upsert` (novas mensagens)
   - `messages.update` (atualizações de mensagens)
   - `connection.update` (status de conexão)
   - `qrcode.updated` (QR code)

**Onde encontrar:**
- Evolution API Dashboard ou via API
- Cada instância precisa ser atualizada individualmente

---

### 2. Chatwoot Webhooks

**URL do Webhook:**
```
https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/chatwoot-webhook
```

**Como Atualizar:**
1. Acesse o Chatwoot Dashboard
2. Vá em **Settings** → **Integrations** → **Webhooks**
3. Crie ou edite o webhook
4. URL: Use a URL acima
5. Método: POST
6. Headers: Adicionar se necessário
7. Eventos: Selecionar eventos relevantes

**Onde encontrar:**
- Chatwoot Dashboard → Settings → Integrations

---

### 3. Facebook Webhooks

**URL do Webhook:**
```
https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/facebook-webhook
```

**Como Atualizar:**
1. Acesse o Facebook Developer Console
   - https://developers.facebook.com/
2. Selecione seu App
3. Vá em **Webhooks** → **Messenger**
4. Clique em **Edit Subscription**
5. Atualize a **Callback URL** para a URL acima
6. Configure o **Verify Token** (deve corresponder ao configurado nas secrets)
7. Selecione os eventos:
   - `messages`
   - `messaging_postbacks`
   - `messaging_optins`

**Onde encontrar:**
- Facebook Developer Console → App → Webhooks

---

### 4. Mercado Pago Webhooks

**URL do Webhook:**
```
https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/mercado-pago-webhook
```

**Como Atualizar:**
1. Acesse o Mercado Pago Dashboard
   - https://www.mercadopago.com.br/developers/panel
2. Vá em **Webhooks** ou **Notificações**
3. Crie ou edite o webhook
4. URL: Use a URL acima
5. Eventos: Selecionar eventos de pagamento:
   - `payment`
   - `merchant_order`
   - `subscription`

**Onde encontrar:**
- Mercado Pago Dashboard → Developers → Webhooks

---

## 🔍 Verificar Edge Functions

Antes de atualizar os webhooks, verifique se as Edge Functions estão deployadas:

### Edge Functions Necessárias:
- ✅ `evolution-webhook` (deployado)
- ✅ `chatwoot-webhook` (deployado)
- ✅ `facebook-webhook` (deployado)
- ✅ `mercado-pago-webhook` (deployado)

**Verificar:**
```bash
supabase functions list
```

---

## 🧪 Testar Webhooks

Após atualizar cada webhook, teste para garantir que está funcionando:

### Teste Evolution API:
1. Envie uma mensagem de teste via WhatsApp
2. Verifique os logs da Edge Function:
   ```bash
   supabase functions logs evolution-webhook
   ```

### Teste Chatwoot:
1. Crie uma conversa de teste no Chatwoot
2. Verifique os logs:
   ```bash
   supabase functions logs chatwoot-webhook
   ```

### Teste Facebook:
1. Envie uma mensagem de teste via Messenger
2. Verifique os logs:
   ```bash
   supabase functions logs facebook-webhook
   ```

### Teste Mercado Pago:
1. Crie um pagamento de teste
2. Verifique os logs:
   ```bash
   supabase functions logs mercado-pago-webhook
   ```

---

## 📝 Checklist

- [ ] Evolution API webhooks atualizados
- [ ] Chatwoot webhooks atualizados
- [ ] Facebook webhooks atualizados
- [ ] Mercado Pago webhooks atualizados
- [ ] Todos os webhooks testados
- [ ] Logs verificados para cada webhook

---

## ⚠️ Notas Importantes

1. **Service Role Key**: Alguns webhooks podem precisar do Service Role Key nas configurações
2. **CORS**: As Edge Functions já devem ter CORS configurado
3. **Secrets**: Verifique se todos os secrets necessários estão configurados
4. **Timeout**: Webhooks devem responder em menos de 30 segundos

---

## 🎯 Após Concluir

Após atualizar todos os webhooks:

1. ✅ Testar cada integração
2. ✅ Verificar logs das Edge Functions
3. ✅ Confirmar que dados estão sendo recebidos
4. ✅ Marcar migração como 100% completa

---

**Última atualização**: 15/12/2025 01:45




# 🔐 Credenciais do Facebook App - Configuração Rápida

## ✅ Credenciais Fornecidas

```
App ID: 1616642309241531
App Secret: 6513bcad61c0e9355d59cc31de243411
Client Token: ef4a74f7a245713f66688e19d2741516
```

---

## 🚀 Configuração Rápida

### **1. Configurar Variáveis de Ambiente**

No seu ambiente (Lovable Cloud ou Supabase), adicione:

```bash
FACEBOOK_APP_ID=1616642309241531
FACEBOOK_APP_SECRET=6513bcad61c0e9355d59cc31de243411
FACEBOOK_CLIENT_TOKEN=ef4a74f7a245713f66688e19d2741516
FACEBOOK_WEBHOOK_VERIFY_TOKEN=seu_token_secreto_aqui
```

**⚠️ IMPORTANTE:** Gere um `FACEBOOK_WEBHOOK_VERIFY_TOKEN` único e secreto (ex: UUID).

---

### **2. Configurar no Facebook Developer**

1. Acesse: https://developers.facebook.com/apps/1616642309241531/settings/basic/

2. **OAuth Redirect URI:**
   - Vá em: Configurações → Básico → URIs de redirecionamento OAuth válidos
   - Adicione: `https://seu-dominio.com/supabase/functions/v1/facebook-oauth-callback`

3. **Webhook:**
   - Vá em: Webhooks → Adicionar produto → Messenger
   - URL de retorno: `https://seu-dominio.com/supabase/functions/v1/facebook-webhook`
   - Token de verificação: Use o mesmo valor de `FACEBOOK_WEBHOOK_VERIFY_TOKEN`
   - Eventos: `messages`, `message_deliveries`, `message_reads`

4. **Permissões:**
   - Vá em: Permissões e recursos
   - Solicite revisão de: `pages_messaging`, `instagram_manage_messages`

---

## ✅ Pronto!

Após configurar as variáveis de ambiente e o webhook, a integração estará funcionando.

Cada organização poderá conectar suas páginas do Facebook/Instagram clicando em "Conectar com Facebook" na interface.


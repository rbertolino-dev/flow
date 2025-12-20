# 🔐 Variáveis de Ambiente - Lista Completa

## 📋 Variáveis do Supabase (Automáticas)

Estas são geradas automaticamente pelo Supabase, mas precisam ser atualizadas no novo projeto:

```bash
# Frontend (.env ou Lovable Cloud)
VITE_SUPABASE_URL=https://[NOVO_ID].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[NOVA_ANON_KEY]

# Edge Functions (automático, mas verificar)
SUPABASE_URL=https://[NOVO_ID].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[NOVA_SERVICE_ROLE_KEY]
SUPABASE_ANON_KEY=[NOVA_ANON_KEY]
```

---

## 🔵 Facebook/Instagram

```bash
FACEBOOK_APP_ID=1616642309241531
FACEBOOK_APP_SECRET=6513bcad61c0e9355d59cc31de243411
FACEBOOK_CLIENT_TOKEN=ef4a74f7a245713f66688e19d2741516
FACEBOOK_WEBHOOK_VERIFY_TOKEN=[GERAR_NOVO_UUID]
```

**⚠️ IMPORTANTE**: Gerar novo `FACEBOOK_WEBHOOK_VERIFY_TOKEN` único.

**URLs a Atualizar no Facebook Developer:**
- Redirect URI: `https://[NOVO_ID].supabase.co/functions/v1/facebook-oauth-callback`
- Webhook URL: `https://[NOVO_ID].supabase.co/functions/v1/facebook-webhook`

---

## 📱 WhatsApp / Evolution API

```bash
# Evolution API (se usar)
EVOLUTION_API_URL=[URL_DA_API_EVOLUTION]
EVOLUTION_API_KEY=[CHAVE_API_EVOLUTION]

# Modo Teste (opcional)
TEST_MODE=false
WHATSAPP_TEST_PHONE=[NUMERO_TESTE]
WHATSAPP_LOG_ONLY=false
```

**URLs a Atualizar na Evolution API:**
- Webhook URL: `https://[NOVO_ID].supabase.co/functions/v1/evolution-webhook`

---

## 💬 Chatwoot

```bash
CHATWOOT_API_URL=[URL_DO_CHATWOOT]
CHATWOOT_API_TOKEN=[TOKEN_DO_CHATWOOT]
CHATWOOT_PLATFORM_APP_TOKEN=[TOKEN_PLATFORM_APP] # Se usar
```

**URLs a Atualizar no Chatwoot:**
- Webhook URL: `https://[NOVO_ID].supabase.co/functions/v1/chatwoot-webhook`

---

## 📅 Google Calendar

```bash
GOOGLE_CLIENT_ID=[CLIENT_ID_GOOGLE]
GOOGLE_CLIENT_SECRET=[CLIENT_SECRET_GOOGLE]
```

**URLs a Atualizar no Google Cloud Console:**
- Redirect URI: `https://[NOVO_ID].supabase.co/functions/v1/google-calendar-oauth-callback`

---

## 📧 Gmail

```bash
GMAIL_CLIENT_ID=[CLIENT_ID_GMAIL]
GMAIL_CLIENT_SECRET=[CLIENT_SECRET_GMAIL]
```

**URLs a Atualizar no Google Cloud Console:**
- Redirect URI: `https://[NOVO_ID].supabase.co/functions/v1/gmail-oauth-callback`

---

## 🏢 Google Business

```bash
GOOGLE_BUSINESS_CLIENT_ID=[CLIENT_ID]
GOOGLE_BUSINESS_CLIENT_SECRET=[CLIENT_SECRET]
```

**URLs a Atualizar no Google Cloud Console:**
- Redirect URI: `https://[NOVO_ID].supabase.co/functions/v1/google-business-oauth-callback`

---

## 💰 Mercado Pago

```bash
MERCADO_PAGO_ACCESS_TOKEN=[ACCESS_TOKEN]
MERCADO_PAGO_PUBLIC_KEY=[PUBLIC_KEY]
MERCADO_PAGO_WEBHOOK_SECRET=[WEBHOOK_SECRET] # Se usar
```

**URLs a Atualizar no Mercado Pago:**
- Webhook URL: `https://[NOVO_ID].supabase.co/functions/v1/mercado-pago-webhook`

---

## 💳 Asaas

```bash
ASAAS_API_KEY=[API_KEY_ASAAS]
ASAAS_API_URL=https://api.asaas.com/v3
ASAAS_WEBHOOK_TOKEN=[TOKEN_WEBHOOK] # Se usar
```

**URLs a Atualizar no Asaas:**
- Webhook URL: `https://[NOVO_ID].supabase.co/functions/v1/asaas-sync-boleto-status`

---

## 🔄 N8n (Opcional)

```bash
N8N_API_URL=[URL_INSTANCIA_N8N]
N8N_API_KEY=[API_KEY_N8N]
```

---

## 🤖 OpenAI (Agentes IA)

```bash
OPENAI_API_KEY=[API_KEY_OPENAI]
OPENAI_ORG_ID=[ORG_ID] # Opcional
```

---

## 🔗 HubSpot

```bash
HUBSPOT_ACCESS_TOKEN=[ACCESS_TOKEN]
HUBSPOT_REFRESH_TOKEN=[REFRESH_TOKEN] # Se usar OAuth
HUBSPOT_CLIENT_ID=[CLIENT_ID] # Se usar OAuth
HUBSPOT_CLIENT_SECRET=[CLIENT_SECRET] # Se usar OAuth
```

**URLs a Atualizar no HubSpot:**
- Webhook URL: `https://[NOVO_ID].supabase.co/functions/v1/hubspot-webhook`

---

## 📦 Bubble.io (Opcional)

```bash
BUBBLE_API_TOKEN=[API_TOKEN]
BUBBLE_APP_NAME=[APP_NAME]
```

---

## 🔒 DeepSeek (Assistente IA)

```bash
DEEPSEEK_API_KEY=[API_KEY_DEEPSEEK]
```

---

## 📝 Como Configurar no Supabase Dashboard

1. Acesse: **Settings** → **Edge Functions** → **Secrets**
2. Clique em **"Add new secret"**
3. Preencha:
   - **Name**: Nome da variável (ex: `FACEBOOK_APP_ID`)
   - **Value**: Valor da variável
4. Clique em **Save**
5. Repita para todas as variáveis

---

## 📝 Como Configurar no Lovable Cloud

1. Acesse o projeto no Lovable Cloud
2. Vá em **Settings** → **Environment Variables**
3. Adicione cada variável:
   - **Key**: Nome da variável (ex: `VITE_SUPABASE_URL`)
   - **Value**: Valor da variável
4. Clique em **Save**
5. Faça redeploy da aplicação

---

## ⚠️ Importante

- ✅ **NUNCA** commitar essas variáveis no código
- ✅ Usar sempre variáveis de ambiente
- ✅ Rotacionar credenciais após migração
- ✅ Documentar todas em local seguro
- ✅ Usar gerenciador de secrets

---

## 🔄 Checklist de Atualização

Após criar novo projeto Supabase:

- [ ] Atualizar `VITE_SUPABASE_URL` no frontend
- [ ] Atualizar `VITE_SUPABASE_PUBLISHABLE_KEY` no frontend
- [ ] Configurar `SUPABASE_SERVICE_ROLE_KEY` nas Edge Functions
- [ ] Atualizar URLs de webhooks em todos os serviços externos
- [ ] Atualizar Redirect URIs OAuth no Google Cloud Console
- [ ] Atualizar Redirect URIs OAuth no Facebook Developer
- [ ] Testar todas as integrações após atualização






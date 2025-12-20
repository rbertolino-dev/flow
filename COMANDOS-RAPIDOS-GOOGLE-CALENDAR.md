# ⚡ Comandos Rápidos - Configurar Google Calendar

## 🎯 Resumo Rápido

Você precisa configurar 2 variáveis de ambiente no Supabase com as credenciais fornecidas.

---

## 📋 Opção 1: Via Dashboard (Mais Fácil)

1. **Acesse:** https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/settings/functions

2. **Adicione as seguintes variáveis:**

   **Variável 1:**
   - Nome: `GOOGLE_CALENDAR_CLIENT_ID`
   - Valor: `SEU_CLIENT_ID_AQUI` (obtenha em https://console.cloud.google.com/apis/credentials)

   **Variável 2:**
   - Nome: `GOOGLE_CALENDAR_CLIENT_SECRET`
   - Valor: `SEU_CLIENT_SECRET_AQUI` (obtenha em https://console.cloud.google.com/apis/credentials)

3. **Salve cada uma**

---

## 📋 Opção 2: Via CLI (Mais Rápido)

Se você tem o Supabase CLI instalado:

```bash
# Fazer login (se ainda não fez)
supabase login

# Configurar Client ID (substitua SEU_CLIENT_ID_AQUI pelo valor real)
supabase secrets set GOOGLE_CALENDAR_CLIENT_ID=SEU_CLIENT_ID_AQUI --project-ref ogeljmbhqxpfjbpnbwog

# Configurar Client Secret (substitua SEU_CLIENT_SECRET_AQUI pelo valor real)
supabase secrets set GOOGLE_CALENDAR_CLIENT_SECRET=SEU_CLIENT_SECRET_AQUI --project-ref ogeljmbhqxpfjbpnbwog
```

**Ou use o script:**
```bash
./scripts/configurar-google-calendar-secrets.sh
```

---

## ⚠️ IMPORTANTE: Corrigir Redirect URI no Google Cloud Console

O redirect URI que você configurou está **ERRADO**. O correto é:

1. Acesse: https://console.cloud.google.com/apis/credentials
2. Clique no seu OAuth 2.0 Client ID
3. Em **Authorized redirect URIs**, adicione/edite:
   ```
   https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/google-calendar-oauth-callback
   ```
   ⚠️ Note: é `oauth-callback` (não `oauth-init`)
4. **Salve**

---

## ✅ Testar

Após configurar:

1. Aguarde 1-2 minutos para propagar
2. Acesse: `/calendar`
3. Vá na aba **Integração**
4. Clique em **"Conectar com Google"**
5. Se aparecer a tela de login do Google = ✅ Funcionando!

---

## 🐛 Problemas Comuns

### "Credenciais OAuth não configuradas"
- Verifique se os nomes estão **exatamente** como mostrado (case-sensitive)
- Aguarde alguns minutos e tente novamente

### "redirect_uri_mismatch"
- Verifique se o redirect URI no Google Cloud Console está correto
- Deve ser: `.../google-calendar-oauth-callback` (não `oauth-init`)



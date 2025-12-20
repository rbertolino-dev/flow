# 🔐 Configurar Credenciais do Google Calendar no Supabase

## ✅ Como Obter as Credenciais:

1. Acesse: https://console.cloud.google.com/apis/credentials
2. Crie um projeto OAuth 2.0 ou use um existente
3. Configure as credenciais:
   - **Client ID:** Obtenha no Google Cloud Console
   - **Client Secret:** Obtenha no Google Cloud Console

⚠️ **IMPORTANTE:** O "token" que você mencionou é na verdade o **Client Secret** do Google OAuth.

## 📋 Passo a Passo para Configurar no Supabase

### Opção 1: Via Dashboard do Supabase (Recomendado)

1. **Acesse o Dashboard do Supabase:**
   - Vá para: https://supabase.com/dashboard
   - Selecione seu projeto: `ogeljmbhqxpfjbpnbwog`

2. **Navegue até Edge Functions Secrets:**
   - No menu lateral, vá em **Settings** (Configurações)
   - Clique em **Edge Functions**
   - Role até a seção **Secrets** ou **Environment Variables**

3. **Adicione as Variáveis:**
   
   **Variável 1:**
   - **Nome:** `GOOGLE_CALENDAR_CLIENT_ID`
   - **Valor:** `SEU_CLIENT_ID_AQUI` (obtenha no Google Cloud Console)
   - Clique em **Add Secret** ou **Save**

   **Variável 2:**
   - **Nome:** `GOOGLE_CALENDAR_CLIENT_SECRET`
   - **Valor:** `SEU_CLIENT_SECRET_AQUI` (obtenha no Google Cloud Console)
   - Clique em **Add Secret** ou **Save**

4. **Verifique se foram salvas:**
   - As duas variáveis devem aparecer na lista de secrets
   - Certifique-se de que os nomes estão **exatamente** como mostrado acima (case-sensitive)

### Opção 2: Via CLI do Supabase (Alternativa)

Se você tem o Supabase CLI instalado:

```bash
# Configurar Client ID
supabase secrets set GOOGLE_CALENDAR_CLIENT_ID=SEU_CLIENT_ID_AQUI

# Configurar Client Secret
supabase secrets set GOOGLE_CALENDAR_CLIENT_SECRET=SEU_CLIENT_SECRET_AQUI
```

## ⚠️ IMPORTANTE: Verificar Redirect URI no Google Cloud Console

Antes de testar, certifique-se de que o Redirect URI está configurado corretamente:

1. Acesse: https://console.cloud.google.com
2. Vá em **APIs & Services** → **Credentials**
3. Clique no seu OAuth 2.0 Client ID
4. Em **Authorized redirect URIs**, adicione/verifique:
   ```
   https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/google-calendar-oauth-callback
   ```
5. **Salve** as alterações

## ✅ Verificar se Está Funcionando

Após configurar as credenciais:

1. Aguarde alguns segundos para as variáveis serem propagadas
2. Acesse sua aplicação: `/calendar`
3. Vá na aba **Integração**
4. Clique em **"Conectar com Google"**
5. Se aparecer a tela de login do Google, as credenciais estão funcionando! ✅

## 🐛 Troubleshooting

### Erro: "Credenciais OAuth não configuradas"
- Verifique se os nomes das variáveis estão **exatamente** como:
  - `GOOGLE_CALENDAR_CLIENT_ID` (não `GOOGLE_CALENDAR_CLIENT_ID_` ou similar)
  - `GOOGLE_CALENDAR_CLIENT_SECRET` (não `GOOGLE_CALENDAR_CLIENT_SECRET_` ou similar)
- Verifique se não há espaços extras nos valores
- Aguarde alguns minutos e tente novamente (pode levar tempo para propagar)

### Erro: "redirect_uri_mismatch"
- Verifique se o redirect URI no Google Cloud Console está correto
- Deve ser: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/google-calendar-oauth-callback`
- Certifique-se de que salvou as alterações no Google Cloud Console

## 🔒 Segurança

⚠️ **NUNCA** commite essas credenciais no código!
- Elas devem estar apenas como secrets no Supabase
- Não adicione em arquivos `.env` que sejam commitados
- Não compartilhe essas credenciais publicamente


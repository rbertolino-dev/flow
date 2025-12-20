# 📅 Guia Completo de Configuração do Google Calendar

## ✅ O que você já fez:
- ✅ Configurou o redirect URI no Google Cloud Console: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/google-calendar-oauth-init`

## ⚠️ O que ainda precisa fazer:

### 1. **Configurar Variáveis de Ambiente no Supabase**

Você precisa configurar as seguintes variáveis de ambiente no Supabase (Lovable Cloud):

1. Acesse o painel do Supabase/Lovable Cloud
2. Vá em **Settings** → **Edge Functions** → **Secrets** (ou **Environment Variables**)
3. Adicione as seguintes variáveis:

```
GOOGLE_CALENDAR_CLIENT_ID=seu_client_id_aqui
GOOGLE_CALENDAR_CLIENT_SECRET=seu_client_secret_aqui
```

**Onde encontrar essas credenciais:**
- Acesse: https://console.cloud.google.com
- Vá em **APIs & Services** → **Credentials**
- Encontre seu **OAuth 2.0 Client ID**
- Copie o **Client ID** e o **Client Secret**

### 2. **Verificar Redirect URI no Google Cloud Console**

O redirect URI deve ser **exatamente** este:

```
https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/google-calendar-oauth-callback
```

**⚠️ ATENÇÃO:** 
- O redirect URI que você configurou (`google-calendar-oauth-init`) está **ERRADO**
- O correto é `google-calendar-oauth-callback` (não `init`)
- O `oauth-init` é a função que **inicia** o OAuth
- O `oauth-callback` é a função que **recebe** o callback do Google

**Como corrigir:**
1. Acesse: https://console.cloud.google.com
2. Vá em **APIs & Services** → **Credentials**
3. Clique no seu **OAuth 2.0 Client ID**
4. Em **Authorized redirect URIs**, adicione/edite:
   ```
   https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/google-calendar-oauth-callback
   ```
5. Salve as alterações

### 3. **Verificar Escopos da API**

No Google Cloud Console, certifique-se de que a **Google Calendar API** está habilitada:

1. Acesse: https://console.cloud.google.com
2. Vá em **APIs & Services** → **Library**
3. Procure por **Google Calendar API**
4. Se não estiver habilitada, clique em **Enable**

### 4. **Testar a Integração**

Após configurar tudo:

1. Acesse a aplicação: `/calendar`
2. Vá na aba **Integração**
3. Clique em **"Conectar com Google"**
4. Faça login com sua conta Google
5. Autorize o acesso ao Google Calendar
6. A conta deve aparecer na lista de contas conectadas

## 🔍 Verificações Finais

### Verificar se as Edge Functions estão configuradas corretamente:

No arquivo `supabase/config.toml`, verifique:

```toml
[functions.google-calendar-oauth-init]
verify_jwt = true

[functions.google-calendar-oauth-callback]
verify_jwt = false
```

### Verificar se a tabela existe no banco:

Execute no SQL Editor do Supabase:

```sql
SELECT * FROM google_calendar_configs LIMIT 1;
```

Se retornar erro, a tabela não existe e você precisa aplicar a migration:
- `20250120000000_create_google_calendar_tables.sql`

## 🐛 Troubleshooting

### Erro: "Credenciais OAuth não configuradas"
- ✅ Verifique se `GOOGLE_CALENDAR_CLIENT_ID` e `GOOGLE_CALENDAR_CLIENT_SECRET` estão configuradas no Supabase
- ✅ Verifique se os nomes estão exatamente como mostrado (case-sensitive)

### Erro: "redirect_uri_mismatch"
- ✅ Verifique se o redirect URI no Google Cloud Console está **exatamente** como: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/google-calendar-oauth-callback`
- ✅ Certifique-se de que não há espaços ou caracteres extras

### Erro: "Refresh token não recebido"
- ✅ Verifique se o `prompt=consent` está sendo enviado (já está no código)
- ✅ Tente revogar o acesso anterior e autorizar novamente

### Popup bloqueado
- ✅ Permita popups no navegador para o domínio da aplicação

## 📝 Resumo dos Passos

1. ✅ Configurar `GOOGLE_CALENDAR_CLIENT_ID` no Supabase
2. ✅ Configurar `GOOGLE_CALENDAR_CLIENT_SECRET` no Supabase
3. ✅ Corrigir redirect URI no Google Cloud Console para `google-calendar-oauth-callback`
4. ✅ Habilitar Google Calendar API no Google Cloud Console
5. ✅ Testar a integração na página `/calendar`

## 🎯 Próximos Passos Após Configuração

Após conectar a conta:
- Os eventos serão sincronizados automaticamente via cron job (a cada 15 minutos)
- Você pode sincronizar manualmente clicando no botão de refresh
- Os eventos aparecerão na aba **Agenda** da página `/calendar`



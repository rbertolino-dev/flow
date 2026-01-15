# Correção CORS Google Drive OAuth

## ✅ Correções Aplicadas

1. **Configuração no `config.toml`**
   - Adicionada `[functions.google-drive-oauth]` com `verify_jwt = false`
   - Isso permite que o OPTIONS (preflight) seja processado pela função

2. **Melhorias nos Headers CORS**
   - Adicionado `Access-Control-Allow-Methods: GET, POST, OPTIONS`
   - Adicionado `Access-Control-Max-Age: 86400` (cache de 24h)
   - OPTIONS agora retorna status `204 No Content` (padrão HTTP)

3. **Código da Edge Function**
   - OPTIONS é tratado ANTES de qualquer verificação
   - Headers CORS completos em todas as respostas

## ⚠️ IMPORTANTE: Configuração no Google Cloud Console

O erro de CORS pode persistir se o **Google Cloud Console** não estiver configurado corretamente. Siga estes passos:

### 1. Acessar Google Cloud Console

1. Acesse: https://console.cloud.google.com/
2. Selecione o projeto correto
3. Vá em **APIs & Services** → **Credentials**

### 2. Configurar OAuth 2.0 Client ID

1. Encontre o **OAuth 2.0 Client ID** usado pela aplicação
2. Clique para editar
3. Em **Authorized JavaScript origins**, adicione:
   ```
   https://agilizeflow.com.br
   ```
4. Em **Authorized redirect URIs**, adicione:
   ```
   https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/google-drive-oauth?action=handle-callback
   ```
5. Salve as alterações

### 3. Verificar Variáveis de Ambiente no Supabase

Certifique-se de que estas variáveis estão configuradas no Supabase Dashboard:

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/settings/functions
2. Verifique se existem:
   - `GOOGLE_CLIENT_ID` - ID do cliente OAuth do Google
   - `GOOGLE_CLIENT_SECRET` - Secret do cliente OAuth do Google
   - `GOOGLE_REDIRECT_URI` - Deve ser: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/google-drive-oauth?action=handle-callback`

### 4. Aplicar Migration no Banco de Dados

A migration `20260115000003_create_client_google_drive_configs.sql` precisa ser aplicada:

```bash
# Via Supabase CLI
supabase migration up

# Ou via Dashboard SQL Editor
# Copie e execute o conteúdo do arquivo de migration
```

## 🔍 Verificação

Após aplicar as configurações:

1. **Limpar cache do navegador** (Ctrl+Shift+R ou Cmd+Shift+R)
2. **Testar conexão do Google Drive novamente**
3. **Verificar console do navegador** para erros

## 📝 Notas Técnicas

- O Supabase pode levar alguns minutos para aplicar mudanças no `config.toml`
- Se o erro persistir após 5 minutos, verifique os logs da edge function no Supabase Dashboard
- O erro de CORS geralmente indica que o OPTIONS não está retornando status 200/204, ou que os headers não estão corretos

## 🐛 Troubleshooting

Se ainda houver erro de CORS:

1. **Verificar logs da edge function:**
   - Supabase Dashboard → Edge Functions → google-drive-oauth → Logs

2. **Testar OPTIONS manualmente:**
   ```bash
   curl -X OPTIONS \
     -H "Origin: https://agilizeflow.com.br" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: authorization,content-type" \
     -v \
     https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/google-drive-oauth?action=get-auth-url
   ```
   
   Deve retornar status `204` com headers CORS.

3. **Verificar se a função está deployada:**
   - Supabase Dashboard → Edge Functions → Verificar se `google-drive-oauth` está listada

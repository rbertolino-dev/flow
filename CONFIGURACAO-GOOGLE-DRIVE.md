# 🔐 Configuração do Google Drive para Backup de Contratos

## ✅ O que foi implementado:

1. **Tabela `client_google_drive_configs`** - Armazena configurações de Google Drive por cliente
2. **Edge Function `google-drive-oauth`** - Gerencia OAuth e cria pasta automaticamente
3. **Hook `useGoogleDriveOAuth`** - Gerencia conexão/desconexão no frontend
4. **Componente `GoogleDriveBackupButton`** - Botão para conectar e fazer backup
5. **Criação automática de pasta** - Cria pasta "Contratos [Nome da Empresa]" no Google Drive do cliente

## 📋 Passo a Passo para Configurar:

### 1. Configurar Variáveis de Ambiente no Supabase

Acesse: **Dashboard Supabase → Settings → Edge Functions → Secrets**

Adicione as seguintes variáveis:

```
GOOGLE_CLIENT_ID=seu_client_id_aqui
GOOGLE_CLIENT_SECRET=seu_client_secret_aqui
GOOGLE_REDIRECT_URI=https://[SEU_PROJECT_ID].supabase.co/functions/v1/google-drive-oauth?action=handle-callback
```

**⚠️ IMPORTANTE:** Substitua `[SEU_PROJECT_ID]` pelo ID do seu projeto Supabase.

**Exemplo:**
```
GOOGLE_REDIRECT_URI=https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/google-drive-oauth?action=handle-callback
```

### 2. Configurar Redirect URI no Google Cloud Console

1. Acesse: https://console.cloud.google.com
2. Vá em **APIs & Services** → **Credentials**
3. Clique no seu **OAuth 2.0 Client ID**
4. Em **Authorized redirect URIs**, adicione:

```
https://[SEU_PROJECT_ID].supabase.co/functions/v1/google-drive-oauth?action=handle-callback
```

**⚠️ IMPORTANTE:** O redirect URI deve ser **exatamente** este formato, incluindo o `?action=handle-callback`.

### 3. Habilitar Google Drive API

1. Acesse: https://console.cloud.google.com
2. Vá em **APIs & Services** → **Library**
3. Procure por **Google Drive API**
4. Clique em **Enable**

### 4. Verificar Escopos

O escopo usado é: `https://www.googleapis.com/auth/drive.file`

Este escopo permite:
- ✅ Criar arquivos e pastas
- ✅ Acessar apenas arquivos criados pela aplicação
- ✅ Não acessa arquivos existentes do usuário (mais seguro)

## 🔄 Fluxo de Funcionamento:

1. **Usuário clica em "Conectar Google Drive"** no contrato
2. **Popup abre** com tela de autorização do Google
3. **Usuário autoriza** acesso ao Google Drive
4. **Google redireciona** para edge function com código
5. **Edge function:**
   - Troca código por tokens
   - Busca nome da organização
   - **Cria pasta "Contratos [Nome da Empresa]"** no Google Drive do cliente
   - Salva tokens e folder_id no banco
   - Retorna página HTML com postMessage
6. **Popup fecha automaticamente** e notifica sucesso
7. **Botão muda** para "Salvar no Google Drive"

## 📁 Estrutura de Dados:

### Tabela `client_google_drive_configs`:

```sql
- id: uuid (PK)
- lead_id: uuid (FK para leads)
- organization_id: uuid (FK para organizations)
- access_token: text (token de acesso, expira em ~1h)
- refresh_token: text (token para renovar access_token)
- token_expires_at: timestamptz (data de expiração)
- google_email: text (email da conta Google)
- google_drive_folder_id: text (ID da pasta criada)
- is_active: boolean (se está ativa)
- created_at: timestamptz
- updated_at: timestamptz
```

## 🚀 Como Usar:

1. **Visualizar contrato** → Ver seção "Backup no Google Drive"
2. **Se não conectado:** Clicar em "Conectar Google Drive"
3. **Autorizar no popup** do Google
4. **Após conexão:** Botão muda para "Salvar no Google Drive"
5. **Clicar em "Salvar"** → PDF é enviado para pasta do cliente no Google Drive

## 🔍 Troubleshooting:

### Erro: "Popup bloqueado"
- **Solução:** Permitir popups para o site

### Erro: "Código ou estado não encontrado"
- **Solução:** Verificar se redirect URI está configurado corretamente no Google Cloud Console

### Erro: "Erro ao criar pasta"
- **Solução:** Verificar se Google Drive API está habilitada e se escopos estão corretos

### Pasta não é criada
- **Solução:** Verificar logs da edge function. A pasta pode não ser criada se houver erro, mas o sistema continua funcionando (pode criar depois)

### Token expirado
- **Solução:** O sistema renova automaticamente via `google-drive-refresh-token`. Se falhar, cliente precisa reconectar.

## 📝 Notas Importantes:

- ✅ Cada cliente (lead) pode ter seu próprio Google Drive conectado
- ✅ A pasta é criada automaticamente no Google Drive do cliente
- ✅ PDFs são salvos na pasta "Contratos [Nome da Empresa]"
- ✅ O sistema usa escopo restrito (`drive.file`) para segurança
- ✅ Tokens são renovados automaticamente quando necessário
- ✅ Backup é opcional - contratos sempre ficam no Supabase primeiro

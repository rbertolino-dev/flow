# Correções Implementadas - Backup Google Drive

## Data: 2026-01-03

## Problema Identificado

O backup no Google Drive estava falhando porque:

1. **Token não era renovado automaticamente**: Quando o `access_token` expirava, o sistema não tentava renovar automaticamente usando o `refresh_token`.

2. **Token não era atualizado no banco**: Mesmo quando renovado, o novo token não era salvo no banco de dados, causando falhas em operações subsequentes.

3. **Edge Function não recebia config_id**: A Edge Function `google-drive-refresh-token` não recebia o ID da configuração, impossibilitando atualizar o banco após renovar o token.

## Correções Implementadas

### 1. Adicionado `configId` na Interface `GoogleDriveConfig`

**Arquivo:** `src/services/contractStorage/GoogleDriveStorageService.ts`

- Adicionado campo `configId: string` na interface para identificar a configuração no banco
- Permite atualizar tokens após renovação

### 2. Renovação Automática de Token

**Arquivo:** `src/services/contractStorage/GoogleDriveStorageService.ts`

**Mudança em `getAccessToken()`:**
- Antes: Lançava erro quando token expirava
- Agora: Renova automaticamente se token expirou ou vai expirar em menos de 5 minutos
- Chama `refreshAccessToken()` automaticamente quando necessário

### 3. Atualização do Banco Após Renovação

**Arquivo:** `src/services/contractStorage/GoogleDriveStorageService.ts`

**Mudança em `refreshAccessToken()`:**
- Agora envia `config_id` para a Edge Function
- Atualiza `config` local com novo token após renovação
- Inclui autenticação via `session.access_token` do Supabase

### 4. Edge Function Atualizada

**Arquivo:** `supabase/functions/google-drive-refresh-token/index.ts`

**Mudanças:**
- Agora recebe `config_id` no body da requisição
- Usa `SUPABASE_SERVICE_ROLE_KEY` para bypass RLS
- Atualiza `client_google_drive_configs` com novo `access_token` e `token_expires_at`
- Não falha a requisição se atualização do banco falhar (token foi renovado com sucesso)

### 5. Passagem de `configId` ao Serviço

**Arquivo:** `src/services/contractStorage/createGoogleDriveServiceForClient.ts`

**Mudança:**
- Agora passa `configId: config.id` ao criar `GoogleDriveStorageService`
- Permite que o serviço atualize tokens no banco após renovação

## Fluxo Corrigido

```
1. Usuário tenta fazer backup no Google Drive
   ↓
2. GoogleDriveStorageService.getAccessToken() verifica se token expirou
   ↓
3. Se expirou (ou vai expirar em < 5min):
   ↓
4. Chama refreshAccessToken()
   ↓
5. refreshAccessToken() chama Edge Function com config_id
   ↓
6. Edge Function renova token no Google
   ↓
7. Edge Function atualiza banco (client_google_drive_configs)
   ↓
8. refreshAccessToken() atualiza config local
   ↓
9. Retorna novo access_token
   ↓
10. Operação (upload/list/delete) usa novo token
   ↓
11. ✅ Backup funciona corretamente!
```

## Métodos Atualizados

Todos os métodos de `GoogleDriveStorageService` agora usam `getAccessToken()` que renova automaticamente:

- ✅ `uploadPDF()` - Upload de PDFs
- ✅ `getPDFUrl()` - Buscar URL do PDF
- ✅ `deletePDF()` - Deletar PDF
- ✅ `getFileSize()` - Obter tamanho do arquivo
- ✅ `listFiles()` - Listar arquivos

## Variáveis de Ambiente Necessárias

A Edge Function precisa das seguintes variáveis:

- `GOOGLE_CLIENT_ID` - ID do cliente OAuth do Google
- `GOOGLE_CLIENT_SECRET` - Secret do cliente OAuth do Google
- `SUPABASE_URL` - URL do projeto Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Service Role Key para bypass RLS

## Testes Recomendados

1. ✅ Fazer backup de contrato quando token está válido
2. ✅ Fazer backup de contrato quando token expirou (deve renovar automaticamente)
3. ✅ Verificar se token foi atualizado no banco após renovação
4. ✅ Fazer múltiplos backups consecutivos (deve usar token renovado)
5. ✅ Verificar logs da Edge Function para confirmar atualização do banco

## Próximos Passos (Opcional)

- [ ] Adicionar retry automático se renovação falhar
- [ ] Adicionar logs mais detalhados para debug
- [ ] Implementar cache de token em memória para evitar múltiplas renovações simultâneas
- [ ] Adicionar métricas de uso do Google Drive API

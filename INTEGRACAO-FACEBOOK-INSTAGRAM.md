# 📱 Integração Facebook Messenger e Instagram Direct Messages

## 📋 Visão Geral

Este documento detalha todos os dados e configurações necessários para integrar o Facebook Messenger e Instagram Direct Messages como canais omnicanal no sistema, centralizando mensagens recebidas e enviadas.

**⚠️ IMPORTANTE:** Cada organização do sistema fará login individual com suas próprias contas do Facebook/Instagram. O processo é similar ao Gmail - cada cliente conecta suas próprias redes sociais.

---

## 🔄 Fluxo de Autenticação por Organização

### **OPÇÃO 1: OAuth Automático (Recomendado - como Gmail)**

**Como Funciona:**

1. **App compartilhado:**
   - Um único App Facebook Developer para todas as organizações
   - App ID e App Secret ficam em variáveis de ambiente
   - Cada organização obtém seus próprios tokens via OAuth

2. **Cada organização faz login próprio:**
   - Usuário da organização clica em "Conectar Facebook/Instagram"
   - Sistema redireciona para OAuth do Facebook
   - Usuário autoriza acesso às páginas/contas dele
   - Facebook retorna tokens específicos daquela organização
   - Tokens são salvos vinculados ao `organization_id`

3. **Isolamento por organização:**
   - Cada organização vê apenas suas próprias páginas/contas conectadas
   - Mensagens são processadas e vinculadas à organização correta
   - Webhooks identificam qual organização através do `page_id` ou `instagram_account_id`

**Vantagens:**
- ✅ Mais seguro (tokens obtidos diretamente do Facebook)
- ✅ Renovação automática de tokens
- ✅ Usuário não precisa saber onde encontrar tokens
- ✅ Experiência mais fluida

**Desvantagens:**
- ⚠️ Requer configuração inicial do App no Facebook Developer
- ⚠️ Requer revisão de permissões pelo Facebook

---

### **OPÇÃO 2: Manual (Como Chatwoot)**

**Como Funciona:**

1. **Cada organização fornece credenciais manualmente:**
   - Usuário acessa Facebook Developer ou Graph API Explorer
   - Gera um Page Access Token de longa duração
   - Copia Page ID e Page Access Token
   - Cola no sistema (interface similar ao Chatwoot)

2. **Isolamento por organização:**
   - Cada organização cadastra suas próprias credenciais
   - Credenciais são salvas vinculadas ao `organization_id`
   - Mensagens são processadas e vinculadas à organização correta

**Vantagens:**
- ✅ Mais simples de implementar (não precisa OAuth flow)
- ✅ Cada cliente gerencia seus próprios tokens
- ✅ Não precisa de App compartilhado

**Desvantagens:**
- ⚠️ Usuário precisa saber gerar tokens manualmente
- ⚠️ Tokens podem expirar e precisam ser renovados manualmente
- ⚠️ Menos seguro (tokens visíveis na interface)
- ⚠️ Mais propenso a erros do usuário

---

### **Qual Escolher?**

**Recomendação: OPÇÃO 1 (OAuth)** - Mais profissional e seguro, similar ao Gmail.

**Se preferir simplicidade: OPÇÃO 2 (Manual)** - Similar ao Chatwoot, mais rápido de implementar.

---

## 🔑 Dados Necessários do Facebook Developer

### **Se escolher OPÇÃO 1: OAuth Automático**

#### **Dados do App (variáveis de ambiente - uma vez só):**
- ✅ **App ID** (`FACEBOOK_APP_ID`) - ID do aplicativo
- ✅ **App Secret** (`FACEBOOK_APP_SECRET`) - Chave secreta do aplicativo
- ✅ **Webhook Verify Token** (`FACEBOOK_WEBHOOK_VERIFY_TOKEN`) - Token para verificar webhook
- ✅ **Redirect URI** - URL de callback OAuth (ex: `https://seu-dominio.com/supabase/functions/v1/facebook-oauth-callback`)

#### **Onde encontrar no Facebook Developer:**

1. **App ID e App Secret:**
   - Vá em: `Configurações` → `Básico`
   - Copie o **ID do aplicativo** e **Chave secreta do aplicativo**

2. **Configurar Redirect URI:**
   - Vá em: `Configurações` → `Básico` → `URIs de redirecionamento OAuth válidos`
   - Adicione: `https://seu-dominio.com/supabase/functions/v1/facebook-oauth-callback`

---

### **Se escolher OPÇÃO 2: Manual (Como Chatwoot)**

#### **Cada organização fornece (via interface):**

1. **Page Access Token:**
   - Gerado via Graph API Explorer ou Facebook Developer
   - Token de longa duração (Long-lived Token)
   - Com permissões: `pages_messaging`, `pages_read_engagement`

2. **Page ID:**
   - ID da página do Facebook
   - Encontrado no Graph API Explorer ou nas configurações da página

3. **Instagram Account ID (opcional):**
   - Se quiser integrar Instagram
   - Encontrado no Graph API Explorer

#### **Como cada cliente obtém (instruções na interface):**

**Para Page Access Token:**
1. Acesse: https://developers.facebook.com/tools/explorer/
2. Selecione sua página no dropdown "Meta App"
3. Clique em "Generate Access Token"
4. Selecione permissões: `pages_messaging`, `pages_read_engagement`
5. Copie o token gerado
6. (Opcional) Converta para Long-lived Token usando a API

**Para Page ID:**
1. No Graph API Explorer, selecione sua página
2. O ID aparece no campo ou na URL
3. Copie o ID

---

## 🔐 Permissões Necessárias no App

### **Permissões do Facebook Messenger:**

1. ✅ `pages_messaging` - Enviar e receber mensagens
2. ✅ `pages_read_engagement` - Ler engajamento da página
3. ✅ `pages_manage_metadata` - Gerenciar metadados (opcional)
4. ✅ `pages_show_list` - Listar páginas do usuário

### **Permissões do Instagram:**

1. ✅ `instagram_basic` - Acesso básico ao Instagram
2. ✅ `instagram_manage_messages` - Gerenciar mensagens do Instagram
3. ✅ `pages_read_engagement` - Ler engajamento

### **Verificar Permissões:**

- Vá em: `Configurações` → `Permissões e recursos`
- Verifique se todas as permissões acima estão aprovadas
- **Importante:** Algumas permissões precisam de revisão do Facebook (especialmente `pages_messaging`)

---

## 🌐 Configuração de Webhooks

### **1. URL do Webhook**

Você precisará configurar uma URL pública para receber eventos:

```
https://seu-dominio.com/supabase/functions/v1/facebook-webhook
```

### **2. Eventos a Subscribir (Webhook Events):**

#### **Para Messenger:**
- ✅ `messages` - Mensagens recebidas/enviadas
- ✅ `messaging_postbacks` - Botões clicados
- ✅ `messaging_referrals` - Referências (códigos QR, etc)
- ✅ `message_deliveries` - Confirmações de entrega
- ✅ `message_reads` - Confirmações de leitura

#### **Para Instagram:**
- ✅ `messages` - Mensagens recebidas/enviadas
- ✅ `messaging_postbacks` - Botões clicados
- ✅ `message_deliveries` - Confirmações de entrega
- ✅ `message_reads` - Confirmações de leitura

### **3. Verify Token (Token de Verificação)**

Você precisará definir um token secreto para verificação do webhook:

- Crie um token aleatório e armazene em variável de ambiente: `FACEBOOK_WEBHOOK_VERIFY_TOKEN`
- Este token será usado na validação inicial do webhook pelo Facebook

### **4. Configurar Webhook no Facebook:**

1. Vá em: `Configurações` → `Webhooks`
2. Clique em "Adicionar produto" → "Messenger"
3. Configure:
   - **URL de retorno**: `https://seu-dominio.com/supabase/functions/v1/facebook-webhook`
   - **Token de verificação**: Valor de `FACEBOOK_WEBHOOK_VERIFY_TOKEN`
   - **Campos de assinatura**: Selecione os eventos acima
4. Repita para Instagram (se aplicável)

---

## 🔐 Permissões Necessárias

### **Permissões do Facebook Messenger:**

1. ✅ `pages_messaging` - Enviar e receber mensagens
2. ✅ `pages_read_engagement` - Ler engajamento da página
3. ✅ `pages_manage_metadata` - Gerenciar metadados (opcional)
4. ✅ `pages_show_list` - Listar páginas do usuário

### **Permissões do Instagram:**

1. ✅ `instagram_basic` - Acesso básico ao Instagram
2. ✅ `instagram_manage_messages` - Gerenciar mensagens do Instagram
3. ✅ `pages_read_engagement` - Ler engajamento

### **Verificar Permissões:**

- Vá em: `Configurações` → `Permissões e recursos`
- Verifique se todas as permissões acima estão aprovadas

---

## 🌐 Configuração de Webhooks

### **1. URL do Webhook**

Você precisará configurar uma URL pública para receber eventos:

```
https://seu-dominio.com/supabase/functions/v1/facebook-webhook
```

### **2. Eventos a Subscribir (Webhook Events):**

#### **Para Messenger:**
- ✅ `messages` - Mensagens recebidas/enviadas
- ✅ `messaging_postbacks` - Botões clicados
- ✅ `messaging_referrals` - Referências (códigos QR, etc)
- ✅ `message_deliveries` - Confirmações de entrega
- ✅ `message_reads` - Confirmações de leitura

#### **Para Instagram:**
- ✅ `messages` - Mensagens recebidas/enviadas
- ✅ `messaging_postbacks` - Botões clicados
- ✅ `message_deliveries` - Confirmações de entrega
- ✅ `message_reads` - Confirmações de leitura

### **3. Verify Token (Token de Verificação)**

Você precisará definir um token secreto para verificação do webhook:

- Crie um token aleatório (ex: `meu_token_secreto_123`)
- Este token será usado na validação inicial do webhook pelo Facebook

### **4. Configurar Webhook no Facebook:**

1. Vá em: `Configurações` → `Webhooks`
2. Clique em "Adicionar produto" → "Messenger"
3. Configure:
   - **URL de retorno**: `https://seu-dominio.com/supabase/functions/v1/facebook-webhook`
   - **Token de verificação**: Seu token secreto
   - **Campos de assinatura**: Selecione os eventos acima

---

## 💾 Estrutura de Dados para Banco de Dados

### **Tabela: `facebook_configs`**

Armazena as configurações de integração por organização (uma linha por página/conta conectada):

```sql
CREATE TABLE IF NOT EXISTS public.facebook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Identificação da conta conectada
  account_name TEXT NOT NULL, -- Nome amigável (ex: "Página Principal", "Instagram Oficial")
  
  -- Tokens (obtidos via OAuth OU fornecidos manualmente)
  page_access_token TEXT NOT NULL, -- Token de acesso da página (long-lived)
  user_access_token TEXT, -- Token do usuário (usado para renovar page tokens - apenas OAuth)
  token_expires_at TIMESTAMPTZ, -- Quando o token expira
  
  -- Identificadores
  page_id TEXT NOT NULL, -- ID da página do Facebook
  page_name TEXT, -- Nome da página (preenchido automaticamente)
  
  -- Configurações do Instagram (opcional - se a página tem Instagram conectado)
  instagram_account_id TEXT,
  instagram_username TEXT,
  instagram_access_token TEXT, -- Pode ser o mesmo page_access_token
  
  -- Status
  enabled BOOLEAN DEFAULT true,
  messenger_enabled BOOLEAN DEFAULT true,
  instagram_enabled BOOLEAN DEFAULT false,
  
  -- Metadados
  last_sync_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Uma organização pode ter múltiplas páginas/contas
  UNIQUE(organization_id, page_id) -- Evita duplicatas da mesma página
);
```

### **Se OPÇÃO 1 (OAuth): Campos Preenchidos Automaticamente**

| Campo | Descrição | Como é Obtido |
|-------|-----------|--------------|
| `page_access_token` | Token de acesso da página | Obtido via OAuth flow (long-lived token) |
| `user_access_token` | Token do usuário | Obtido via OAuth, usado para renovar tokens |
| `page_id` | ID da página do Facebook | Listado durante OAuth, usuário seleciona qual conectar |
| `page_name` | Nome da página | Buscado via Graph API usando `page_access_token` |
| `instagram_account_id` | ID do Instagram (se houver) | Buscado via Graph API se a página tem Instagram conectado |
| `instagram_username` | Username do Instagram | Buscado via Graph API |

### **Se OPÇÃO 2 (Manual): Campos Fornecidos pelo Usuário**

| Campo | Descrição | Como o Usuário Obtém |
|-------|-----------|---------------------|
| `page_access_token` | Token de acesso da página | Gera via Graph API Explorer e cola no sistema |
| `page_id` | ID da página do Facebook | Copia do Graph API Explorer ou configurações da página |
| `instagram_account_id` | ID do Instagram (opcional) | Copia do Graph API Explorer |
| `page_name` | Nome da página | Pode ser preenchido automaticamente via API ou manualmente |

### **Campos Definidos pelo Usuário (Ambas Opções):**

| Campo | Descrição |
|-------|-----------|
| `account_name` | Nome amigável para identificar a conta (ex: "Página Principal", "Instagram Oficial") |
| `messenger_enabled` | Se deseja receber/enviar mensagens do Messenger |
| `instagram_enabled` | Se deseja receber/enviar mensagens do Instagram |

### **Variáveis de Ambiente (Apenas OPÇÃO 1 - OAuth):**

| Variável | Descrição | Onde Obter |
|----------|-----------|------------|
| `FACEBOOK_APP_ID` | ID do aplicativo Facebook | Facebook Developer → Configurações → Básico |
| `FACEBOOK_APP_SECRET` | Chave secreta do app | Facebook Developer → Configurações → Básico |
| `FACEBOOK_WEBHOOK_VERIFY_TOKEN` | Token para verificar webhook | Você cria (ex: UUID aleatório) |

---

## 📨 Estrutura de Mensagens Recebidas

### **Formato do Webhook do Facebook:**

```json
{
  "object": "page",
  "entry": [
    {
      "id": "PAGE_ID",
      "time": 1234567890,
      "messaging": [
        {
          "sender": {
            "id": "USER_PSID"
          },
          "recipient": {
            "id": "PAGE_ID"
          },
          "timestamp": 1234567890,
          "message": {
            "mid": "MESSAGE_ID",
            "text": "Texto da mensagem",
            "attachments": []
          }
        }
      ]
    }
  ]
}
```

### **Dados que Precisamos Extrair:**

1. **Identificação do Contato:**
   - `sender.id` → PSID (Page-Scoped ID) do usuário
   - Este será usado como identificador único (equivalente ao `phone` no WhatsApp)

2. **Conteúdo da Mensagem:**
   - `message.text` → Texto da mensagem
   - `message.attachments` → Mídias (imagens, vídeos, arquivos)

3. **Metadados:**
   - `timestamp` → Data/hora da mensagem
   - `mid` → ID único da mensagem
   - `recipient.id` → Identifica se é Messenger ou Instagram

4. **Identificação do Canal:**
   - Messenger: `recipient.id` = `page_id`
   - Instagram: `recipient.id` = `instagram_account_id`

---

## 🔄 Fluxo de Processamento

### **1. Recebimento de Mensagem (Webhook)**

```
Facebook/Instagram → Webhook → Edge Function → Processar → Criar/Atualizar Lead
```

### **2. Mapeamento de Dados:**

| Facebook/Instagram | Sistema (Leads) |
|-------------------|-----------------|
| `sender.id` (PSID) | `phone` (identificador único) |
| Nome do perfil | `name` |
| `message.text` | Conteúdo da atividade |
| `timestamp` | `last_contact`, `created_at` |
| Canal (Messenger/Instagram) | `source` ('facebook' ou 'instagram') |
| `page_id` ou `instagram_account_id` | `source_instance_id` |

### **3. Identificação de Lead:**

- **Buscar lead existente por:**
  - `phone` = `sender.id` (PSID)
  - `organization_id` = ID da organização
  - `source_instance_id` = `page_id` ou `instagram_account_id`

- **Se não existir:**
  - Criar novo lead
  - `source` = 'facebook' ou 'instagram'
  - `source_instance_id` = ID da página/Instagram
  - `source_instance_name` = Nome da página/Instagram

---

## 📤 Envio de Mensagens

### **API do Graph para Enviar:**

**Endpoint:**
```
POST https://graph.facebook.com/v18.0/{page-id}/messages
```

**Headers:**
```
Authorization: Bearer {page_access_token}
Content-Type: application/json
```

**Body (Messenger):**
```json
{
  "recipient": {
    "id": "USER_PSID"
  },
  "message": {
    "text": "Sua mensagem aqui"
  }
}
```

**Body (Instagram):**
```json
{
  "recipient": {
    "id": "INSTAGRAM_USER_ID"
  },
  "message": {
    "text": "Sua mensagem aqui"
  }
}
```

---

## 🗄️ Estrutura de Banco de Dados Completa

### **1. Tabela de Configuração (já detalhada acima)**

### **2. Integração com Tabela `leads`:**

A tabela `leads` já possui os campos necessários:
- ✅ `phone` → Armazenará o PSID do Facebook/Instagram
- ✅ `source` → 'facebook' ou 'instagram'
- ✅ `source_instance_id` → `page_id` ou `instagram_account_id`
- ✅ `source_instance_name` → Nome da página/Instagram
- ✅ `organization_id` → ID da organização

### **3. Tabela de Atividades:**

A tabela `activities` já existe e será usada para armazenar mensagens:
- ✅ `lead_id` → Referência ao lead
- ✅ `type` → 'message'
- ✅ `content` → Texto da mensagem
- ✅ `direction` → 'incoming' ou 'outgoing'
- ✅ `created_at` → Timestamp da mensagem

---

## 🔄 Fluxo OAuth Completo (por Organização)

### **1. Iniciar OAuth (`facebook-oauth-init`)**

```
Frontend → Edge Function (facebook-oauth-init) → Redireciona para Facebook OAuth
```

**Processo:**
1. Usuário clica em "Conectar Facebook/Instagram" na interface
2. Frontend chama `facebook-oauth-init` com `organization_id`
3. Edge Function gera URL de autorização do Facebook com:
   - `client_id` = `FACEBOOK_APP_ID` (variável de ambiente)
   - `redirect_uri` = URL do callback
   - `scope` = Permissões necessárias
   - `state` = Payload codificado com `organization_id` e `userId`
4. Usuário é redirecionado para Facebook para autorizar

### **2. Callback OAuth (`facebook-oauth-callback`)**

```
Facebook → Edge Function (facebook-oauth-callback) → Salva tokens no banco
```

**Processo:**
1. Facebook redireciona para callback com `code` e `state`
2. Edge Function:
   - Decodifica `state` para obter `organization_id`
   - Troca `code` por `access_token` usando App Secret
   - Busca páginas do usuário via Graph API
   - Permite usuário selecionar qual página/conta conectar
   - Gera `page_access_token` de longa duração
   - Salva na tabela `facebook_configs` vinculado ao `organization_id`
   - Busca informações do Instagram se disponível

### **3. Webhook de Mensagens (`facebook-webhook`)**

```
Facebook → Edge Function (facebook-webhook) → Processa mensagem → Cria/Atualiza Lead
```

**Processo:**
1. Facebook envia evento de mensagem para webhook
2. Edge Function:
   - Valida assinatura do webhook
   - Extrai `page_id` ou `instagram_account_id` do evento
   - Busca `facebook_configs` pelo `page_id` para identificar organização
   - Processa mensagem usando `messaging-helpers.ts`
   - Cria/atualiza lead vinculado à organização correta

---

## 📝 Checklist de Implementação

### **Fase 1: Configuração do App Facebook (Uma vez só)**

- [ ] Criar/verificar app no Facebook Developer
- [ ] Coletar `FACEBOOK_APP_ID`
- [ ] Coletar `FACEBOOK_APP_SECRET`
- [ ] Configurar `Redirect URI` no app: `https://seu-dominio.com/supabase/functions/v1/facebook-oauth-callback`
- [ ] Solicitar revisão de permissões (`pages_messaging`, `instagram_manage_messages`)
- [ ] Criar `FACEBOOK_WEBHOOK_VERIFY_TOKEN` (UUID aleatório)
- [ ] Configurar webhook no Facebook Developer
- [ ] Subscribir eventos necessários (messages, message_deliveries, etc)

### **Fase 2: Implementação no Sistema**

- [ ] Criar migração SQL para tabela `facebook_configs`
- [ ] Criar Edge Function `facebook-oauth-init` (similar ao `gmail-oauth-init`)
- [ ] Criar Edge Function `facebook-oauth-callback` (similar ao `gmail-oauth-callback`)
- [ ] Criar Edge Function `facebook-webhook` (verificação GET + processamento POST)
- [ ] Implementar listagem de páginas durante OAuth
- [ ] Implementar geração de tokens de longa duração
- [ ] Integrar com `messaging-helpers.ts` para criar/atualizar leads
- [ ] Criar função para enviar mensagens via Graph API
- [ ] Criar hook `useFacebookOAuth` (similar ao `useGmailOAuth`)
- [ ] Criar hook `useFacebookConfigs` (similar ao `useGmailConfigs`)
- [ ] Criar interface de configuração no frontend

### **Fase 3: Testes**

- [ ] Testar fluxo OAuth completo
- [ ] Testar conexão de múltiplas páginas por organização
- [ ] Testar isolamento entre organizações (Org A não vê páginas da Org B)
- [ ] Testar recebimento de mensagens do Messenger
- [ ] Testar recebimento de mensagens do Instagram
- [ ] Testar criação de leads
- [ ] Testar atualização de leads existentes
- [ ] Testar envio de mensagens
- [ ] Testar renovação de tokens expirados

---

## 🔒 Segurança

### **Armazenamento de Tokens:**

- ✅ **NUNCA** exponha `app_secret` ou `page_access_token` no frontend
- ✅ Armazene tokens criptografados ou use variáveis de ambiente
- ✅ Use RLS (Row Level Security) na tabela `facebook_configs`
- ✅ Valide `webhook_verify_token` em todas as requisições

### **Validação de Webhook:**

O Facebook envia uma assinatura (`X-Hub-Signature-256`) que deve ser validada:

```typescript
import { createHmac } from 'https://deno.land/std/node/crypto.ts';

const signature = req.headers.get('X-Hub-Signature-256');
const expectedSignature = createHmac('sha256', app_secret)
  .update(body)
  .digest('hex');

if (signature !== `sha256=${expectedSignature}`) {
  return new Response('Invalid signature', { status: 401 });
}
```

---

## 📚 Recursos Adicionais

### **Documentação Oficial:**

- [Facebook Messenger API](https://developers.facebook.com/docs/messenger-platform)
- [Instagram Messaging API](https://developers.facebook.com/docs/instagram-platform/instagram-messaging)
- [Graph API Reference](https://developers.facebook.com/docs/graph-api)
- [Webhooks Guide](https://developers.facebook.com/docs/graph-api/webhooks)

### **Ferramentas Úteis:**

- [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [Webhook Tester](https://webhook.site/) - Para testar webhooks localmente

---

## 🎯 Resumo: O Que Você Precisa Fornecer

### **Se escolher OPÇÃO 1: OAuth Automático**

#### **Dados do App Facebook (Já configurado):**

1. ✅ **FACEBOOK_APP_ID** = `1616642309241531` (variável de ambiente)
2. ✅ **FACEBOOK_APP_SECRET** = `6513bcad61c0e9355d59cc31de243411` (variável de ambiente)
3. ✅ **FACEBOOK_CLIENT_TOKEN** = `ef4a74f7a245713f66688e19d2741516` (variável de ambiente - opcional)
4. ⚠️ **FACEBOOK_WEBHOOK_VERIFY_TOKEN** - Token para verificar webhook (você cria - variável de ambiente)
5. ✅ **Redirect URI configurado** - No app: `https://seu-dominio.com/supabase/functions/v1/facebook-oauth-callback`

**📝 Veja o arquivo `CONFIGURACAO-FACEBOOK-ENV.md` para instruções detalhadas de configuração.**

#### **Configurações no Facebook Developer:**

5. ✅ **Permissões aprovadas** - `pages_messaging`, `instagram_manage_messages`, etc
6. ✅ **Webhook configurado** - Com eventos subscritos (messages, message_deliveries, etc)
7. ✅ **OAuth Redirect URI** - Adicionado nas configurações do app

#### **O Que Cada Organização Faz (via Interface):**

8. ✅ **Login OAuth** - Cada organização faz login com sua conta Facebook
9. ✅ **Seleciona páginas** - Escolhe quais páginas/contas conectar
10. ✅ **Configura canais** - Ativa/desativa Messenger e Instagram por conta

---

### **Se escolher OPÇÃO 2: Manual (Como Chatwoot)**

#### **Configurações no Sistema (Uma vez só):**

1. ✅ **Webhook configurado** - URL pública para receber eventos
2. ✅ **FACEBOOK_WEBHOOK_VERIFY_TOKEN** - Token para verificar webhook (variável de ambiente)

#### **O Que Cada Organização Faz (via Interface):**

3. ✅ **Gera Page Access Token** - Via Graph API Explorer (instruções na interface)
4. ✅ **Fornece Page ID** - Copia do Graph API Explorer
5. ✅ **Cola credenciais** - Interface similar ao Chatwoot (campos de texto)
6. ✅ **Testa conexão** - Botão para validar se tokens estão corretos
7. ✅ **Configura canais** - Ativa/desativa Messenger e Instagram

**Vantagem:** Não precisa de App compartilhado, cada cliente gerencia seus próprios tokens.

---

## 🔄 Diferenças do Processo Gmail

### **Similaridades:**
- ✅ OAuth flow por organização
- ✅ App compartilhado (variáveis de ambiente)
- ✅ Cada organização vê só suas próprias contas
- ✅ Tokens salvos vinculados ao `organization_id`

### **Diferenças:**
- ⚠️ Facebook requer seleção de páginas (usuário pode ter múltiplas)
- ⚠️ Facebook tem tokens de curta e longa duração (precisa converter)
- ⚠️ Facebook pode ter Instagram conectado à página
- ⚠️ Webhook precisa identificar organização pelo `page_id`

---

## 🚀 Próximos Passos

Após configurar o app no Facebook Developer, podemos:

1. ✅ Criar migração SQL para `facebook_configs`
2. ✅ Criar Edge Functions OAuth (`facebook-oauth-init` e `facebook-oauth-callback`)
3. ✅ Criar Edge Function `facebook-webhook`
4. ✅ Implementar processamento de mensagens
5. ✅ Criar hooks e interface no frontend
6. ✅ Testar integração completa

**Você já tem o app configurado no Facebook Developer com as permissões necessárias?**


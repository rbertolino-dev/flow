# 📋 Plano Completo de Migração do Supabase

## 📊 Análise do Projeto Atual

### Informações do Projeto Supabase

- **Project ID Atual**: `orcbxgajfhgmjobsjlix`
- **URL Base**: `https://orcbxgajfhgmjobsjlix.supabase.co`
- **Total de Migrations**: 215 arquivos SQL
- **Total de Edge Functions**: 86 funções
- **Configuração**: `supabase/config.toml`

### Estrutura do Projeto

```
kanban-buzz-95241/
├── supabase/
│   ├── config.toml (configuração do projeto)
│   ├── migrations/ (215 arquivos SQL)
│   └── functions/ (86 edge functions)
├── src/
│   └── integrations/supabase/
│       ├── client.ts (cliente Supabase)
│       └── types.ts (tipos TypeScript auto-gerados)
└── .env (variáveis de ambiente)
```

---

## 🎯 Objetivo da Migração

Migrar o projeto do Supabase atual para um novo projeto Supabase (ou servidor próprio na Hetzner), incluindo:

1. ✅ Banco de dados (todas as tabelas, dados, RLS policies)
2. ✅ Edge Functions (86 funções)
3. ✅ Variáveis de ambiente e secrets
4. ✅ Configurações de autenticação
5. ✅ Storage (se houver)
6. ✅ Webhooks e integrações externas

---

## 📝 Checklist de Migração

### FASE 1: Preparação e Backup

#### 1.1 Backup do Banco de Dados Atual

```bash
# Instalar Supabase CLI (se não tiver)
npm install -g supabase

# Fazer login
supabase login

# Linkar ao projeto atual
supabase link --project-ref orcbxgajfhgmjobsjlix

# Fazer dump completo do banco
supabase db dump -f backup_completo.sql

# Fazer dump apenas do schema (sem dados)
supabase db dump --schema-only -f backup_schema.sql

# Fazer dump apenas dos dados
supabase db dump --data-only -f backup_dados.sql
```

#### 1.2 Listar Todas as Edge Functions

```bash
# Listar todas as funções
ls -1 supabase/functions/ > lista_funcoes.txt

# Verificar configurações
cat supabase/config.toml
```

#### 1.3 Documentar Variáveis de Ambiente

Criar arquivo `VARIAVEIS_AMBIENTE.md` com todas as variáveis necessárias.

---

### FASE 2: Criar Novo Projeto Supabase

#### 2.1 Opção A: Novo Projeto Supabase Cloud

1. Acesse: https://supabase.com/dashboard
2. Clique em "New Project"
3. Configure:
   - **Name**: `kanban-buzz-novo` (ou nome desejado)
   - **Database Password**: (anotar em local seguro)
   - **Region**: Escolher região próxima
   - **Pricing Plan**: Escolher plano adequado

4. Anotar:
   - **Project ID**: (novo ID)
   - **Project URL**: `https://[NOVO_ID].supabase.co`
   - **API Keys**: Anon Key e Service Role Key

#### 2.2 Opção B: Supabase Self-Hosted (Hetzner)

Se optar por self-hosted na Hetzner:

1. **Criar servidor na Hetzner**
   - Tipo: CPX31 ou superior (4GB RAM mínimo)
   - Sistema: Ubuntu 22.04
   - Localização: Escolher mais próxima

2. **Instalar Supabase via Docker**
   ```bash
   # No servidor Hetzner
   git clone --depth 1 https://github.com/supabase/supabase
   cd supabase/docker
   cp .env.example .env
   # Editar .env com configurações
   docker-compose up -d
   ```

3. **Configurar domínio** (opcional)
   - Configurar DNS apontando para IP do servidor
   - Configurar SSL via Let's Encrypt

---

### FASE 3: Migração do Banco de Dados

#### 3.1 Aplicar Migrations no Novo Projeto

```bash
# Linkar ao novo projeto
supabase link --project-ref [NOVO_PROJECT_ID]

# Aplicar todas as migrations em ordem
supabase db push

# OU aplicar manualmente via SQL Editor no Dashboard
# Importar backup_schema.sql primeiro
```

#### 3.2 Migrar Dados (se necessário)

```bash
# Se precisar migrar dados do projeto antigo:

# 1. Exportar dados do projeto antigo
supabase db dump --data-only -f dados_export.sql

# 2. Importar no novo projeto
# Via SQL Editor no Dashboard ou:
psql -h [NOVO_HOST] -U postgres -d postgres -f dados_export.sql
```

#### 3.3 Verificar RLS Policies

```bash
# Verificar todas as policies aplicadas
supabase db diff

# Se faltar alguma, aplicar manualmente
```

---

### FASE 4: Migração das Edge Functions

#### 4.1 Deploy de Todas as Funções

```bash
# Deploy individual de cada função
for func in supabase/functions/*/; do
    func_name=$(basename "$func")
    echo "Deploying $func_name..."
    supabase functions deploy "$func_name"
done

# OU deploy de todas de uma vez (se suportado)
supabase functions deploy
```

#### 4.2 Configurar Secrets das Edge Functions

No Dashboard do Supabase:
1. Vá em **Settings** → **Edge Functions** → **Secrets**
2. Adicione todas as variáveis de ambiente necessárias

**Variáveis Obrigatórias Identificadas:**

```bash
# Supabase (automático, mas verificar)
SUPABASE_URL=https://[NOVO_ID].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[NOVA_SERVICE_ROLE_KEY]

# Facebook/Instagram
FACEBOOK_APP_ID=1616642309241531
FACEBOOK_APP_SECRET=6513bcad61c0e9355d59cc31de243411
FACEBOOK_CLIENT_TOKEN=ef4a74f7a245713f66688e19d2741516
FACEBOOK_WEBHOOK_VERIFY_TOKEN=[GERAR_NOVO_TOKEN]

# WhatsApp (se usar)
EVOLUTION_API_URL=[URL_DA_API]
EVOLUTION_API_KEY=[CHAVE_API]

# Chatwoot
CHATWOOT_API_URL=[URL_CHATWOOT]
CHATWOOT_API_TOKEN=[TOKEN]

# Google Services
GOOGLE_CLIENT_ID=[CLIENT_ID]
GOOGLE_CLIENT_SECRET=[CLIENT_SECRET]

# Mercado Pago
MERCADO_PAGO_ACCESS_TOKEN=[TOKEN]
MERCADO_PAGO_PUBLIC_KEY=[PUBLIC_KEY]

# Asaas
ASAAS_API_KEY=[API_KEY]
ASAAS_API_URL=https://api.asaas.com/v3

# N8n (se usar)
N8N_API_URL=[URL_N8N]
N8N_API_KEY=[API_KEY]

# OpenAI (se usar Agentes IA)
OPENAI_API_KEY=[API_KEY]
```

#### 4.3 Atualizar URLs nos Webhooks

Após deploy, atualizar URLs nos serviços externos:

**Facebook Developer:**
- Redirect URI: `https://[NOVO_ID].supabase.co/functions/v1/facebook-oauth-callback`
- Webhook URL: `https://[NOVO_ID].supabase.co/functions/v1/facebook-webhook`

**Evolution API:**
- Webhook URL: `https://[NOVO_ID].supabase.co/functions/v1/evolution-webhook`

**Chatwoot:**
- Webhook URL: `https://[NOVO_ID].supabase.co/functions/v1/chatwoot-webhook`

**Mercado Pago:**
- Webhook URL: `https://[NOVO_ID].supabase.co/functions/v1/mercado-pago-webhook`

**Asaas:**
- Webhook URL: `https://[NOVO_ID].supabase.co/functions/v1/asaas-sync-boleto-status`

---

### FASE 5: Atualizar Frontend

#### 5.1 Atualizar Variáveis de Ambiente

No arquivo `.env` ou no Lovable Cloud:

```bash
# Antes
VITE_SUPABASE_URL=https://orcbxgajfhgmjobsjlix.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[CHAVE_ANTIGA]

# Depois
VITE_SUPABASE_URL=https://[NOVO_ID].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[NOVA_CHAVE_ANON]
```

#### 5.2 Atualizar config.toml

```toml
# supabase/config.toml
project_id = "[NOVO_PROJECT_ID]"
```

#### 5.3 Regenerar Types TypeScript

```bash
# Gerar novos tipos do banco
supabase gen types typescript --project-id [NOVO_ID] > src/integrations/supabase/types.ts
```

---

### FASE 6: Testes e Validação

#### 6.1 Checklist de Testes

- [ ] **Autenticação**: Login/logout funcionando
- [ ] **RLS Policies**: Permissões corretas
- [ ] **Edge Functions**: Todas respondendo
- [ ] **Webhooks**: Recebendo chamadas externas
- [ ] **Integrações**: Facebook, WhatsApp, Chatwoot, etc.
- [ ] **Queries**: Todas as queries funcionando
- [ ] **Migrations**: Todas aplicadas corretamente

#### 6.2 Testar Edge Functions Principais

```bash
# Testar algumas funções críticas
curl -X POST https://[NOVO_ID].supabase.co/functions/v1/evolution-webhook \
  -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

### FASE 7: Atualizar Integrações Externas

#### 7.1 Serviços que Precisam Atualização

1. **Facebook Developer Console**
   - Atualizar Redirect URIs
   - Atualizar Webhook URLs

2. **Evolution API**
   - Atualizar webhook URL nas instâncias

3. **Chatwoot**
   - Atualizar webhook URL

4. **Mercado Pago**
   - Atualizar webhook URL

5. **Asaas**
   - Atualizar webhook URL

6. **Google Cloud Console**
   - Atualizar Redirect URIs para OAuth

---

## 🔐 Credenciais e Segurança

### Credenciais a Migrar

1. **Supabase Keys**
   - Anon Key (público, frontend)
   - Service Role Key (secreto, backend)
   - JWT Secret (interno)

2. **API Keys Externas**
   - Facebook App Secret
   - Evolution API Keys
   - Chatwoot Tokens
   - Google OAuth Credentials
   - Mercado Pago Tokens
   - Asaas API Keys
   - OpenAI API Keys (se usar)

### Boas Práticas

- ✅ **NUNCA** commitar credenciais no código
- ✅ Usar variáveis de ambiente sempre
- ✅ Rotacionar credenciais após migração
- ✅ Documentar todas as credenciais em local seguro
- ✅ Usar gerenciador de secrets (1Password, Bitwarden, etc.)

---

## 📊 Lista Completa de Edge Functions

Total: **86 funções** organizadas por categoria:

### WhatsApp e Evolution (8 funções)
- evolution-webhook
- evolution-fetch-chats
- evolution-fetch-messages
- evolution-send-message-direct
- send-whatsapp-message
- validate-whatsapp-number
- create-evolution-instance
- reconnect-evolution-instance

### Workflows WhatsApp (3 funções)
- process-whatsapp-workflows
- publish-whatsapp-status
- process-status-schedule

### Broadcast e Campanhas (2 funções)
- process-broadcast-queue
- process-scheduled-messages

### Chatwoot (14 funções)
- chatwoot-proxy
- chatwoot-add-private-note
- chatwoot-apply-label
- chatwoot-create-canned-response
- chatwoot-create-contact
- chatwoot-create-conversation
- chatwoot-create-label
- chatwoot-execute-macro
- chatwoot-get-conversations
- chatwoot-get-messages
- chatwoot-list-canned-responses
- chatwoot-list-inboxes
- chatwoot-list-labels
- chatwoot-merge-contacts
- chatwoot-send-message
- chatwoot-test-connection
- chatwoot-webhook

### Google Calendar (7 funções)
- google-calendar-oauth-init
- google-calendar-oauth-callback
- sync-google-calendar-events
- list-google-calendars
- get-google-calendar-access-token
- create-google-calendar-event
- update-google-calendar-event
- delete-google-calendar-event

### Gmail (3 funções)
- gmail-oauth-init
- gmail-oauth-callback
- list-gmail-messages
- gmail-send-reply

### Facebook/Instagram (4 funções)
- facebook-oauth-init
- facebook-oauth-callback
- facebook-test-connection
- facebook-webhook

### Google Business (4 funções)
- google-business-oauth-init
- google-business-oauth-callback
- get-google-business-access-token
- create-google-business-post
- process-google-business-posts

### Formulários (2 funções)
- get-form
- submit-form

### Pagamentos (5 funções)
- mercado-pago-create-boleto
- mercado-pago-create-payment
- mercado-pago-webhook
- asaas-create-boleto
- asaas-create-charge
- asaas-sync-boleto-status

### N8n (2 funções)
- n8n-generate-workflow
- n8n-proxy

### Agentes IA (3 funções)
- agents-sync-evolution
- agents-sync-openai
- openai-list-models
- deepseek-assistant

### Bubble Integration (5 funções)
- bubble-check-status
- bubble-list-data-types
- bubble-list-instances
- bubble-query-data
- bubble-send-whatsapp
- bubble-sync-leads

### HubSpot (4 funções)
- hubspot-get-list-contacts
- hubspot-import-list
- hubspot-list-lists
- hubspot-sync-contacts
- hubspot-test-connection
- hubspot-webhook

### Utilitários (6 funções)
- create-user
- import-contacts
- log-auth-attempt
- patch-call-queue-org
- sync-daily-metrics
- apply-fix-recipient-type

---

## 🚨 Pontos de Atenção

### 1. Ordem de Migração

⚠️ **IMPORTANTE**: Manter ordem correta:
1. Banco de dados (schema + dados)
2. Edge Functions
3. Secrets/Variáveis de ambiente
4. Frontend
5. Integrações externas

### 2. Downtime

- Planejar janela de manutenção
- Considerar migração gradual (blue-green deployment)
- Ter plano de rollback

### 3. Dados em Produção

- Fazer backup completo antes
- Validar integridade dos dados após migração
- Testar em ambiente de staging primeiro

### 4. Webhooks

- Atualizar URLs em todos os serviços externos
- Testar cada webhook após atualização
- Manter projeto antigo ativo temporariamente para transição

---

## 📝 Scripts Úteis

### Script 1: Backup Completo

```bash
#!/bin/bash
# backup_completo.sh

PROJECT_ID="orcbxgajfhgmjobsjlix"
DATE=$(date +%Y%m%d_%H%M%S)

echo "🔄 Fazendo backup do projeto $PROJECT_ID..."

# Backup do banco
supabase db dump -f "backup_${DATE}_database.sql"

# Listar funções
ls -1 supabase/functions/ > "backup_${DATE}_funcoes.txt"

# Exportar config
cp supabase/config.toml "backup_${DATE}_config.toml"

echo "✅ Backup concluído em backup_${DATE}_*"
```

### Script 2: Deploy de Todas as Funções

```bash
#!/bin/bash
# deploy_todas_funcoes.sh

NOVO_PROJECT_ID="[NOVO_ID]"

echo "🚀 Fazendo deploy de todas as Edge Functions..."

for func_dir in supabase/functions/*/; do
    func_name=$(basename "$func_dir")
    echo "📦 Deploying $func_name..."
    supabase functions deploy "$func_name" --project-ref "$NOVO_PROJECT_ID"
    
    if [ $? -eq 0 ]; then
        echo "✅ $func_name deployado com sucesso"
    else
        echo "❌ Erro ao fazer deploy de $func_name"
    fi
done

echo "✅ Deploy concluído!"
```

---

## ✅ Checklist Final

### Antes da Migração
- [ ] Backup completo do banco de dados
- [ ] Backup de todas as Edge Functions
- [ ] Documentar todas as variáveis de ambiente
- [ ] Listar todas as integrações externas
- [ ] Criar novo projeto Supabase
- [ ] Testar em ambiente de staging

### Durante a Migração
- [ ] Aplicar todas as migrations
- [ ] Migrar dados (se necessário)
- [ ] Deploy de todas as Edge Functions
- [ ] Configurar secrets e variáveis
- [ ] Atualizar variáveis no frontend
- [ ] Regenerar types TypeScript

### Após a Migração
- [ ] Testar autenticação
- [ ] Testar todas as Edge Functions
- [ ] Atualizar URLs de webhooks
- [ ] Testar integrações externas
- [ ] Validar dados
- [ ] Monitorar logs
- [ ] Documentar novo projeto

---

## 📞 Próximos Passos

1. **Revisar este plano** e ajustar conforme necessário
2. **Criar novo projeto Supabase** (ou configurar self-hosted)
3. **Fazer backup completo** do projeto atual
4. **Executar migração** seguindo as fases acima
5. **Testar tudo** antes de desativar projeto antigo

---

**Última atualização**: Baseado na análise do projeto atual
**Total de componentes**: 215 migrations + 86 Edge Functions






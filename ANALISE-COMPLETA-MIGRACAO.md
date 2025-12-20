# 🔍 Análise Completa da Migração - O Que Está Faltando

**Data**: 14/12/2025  
**Status**: ⚠️ **ANÁLISE CRÍTICA - ITENS FALTANDO IDENTIFICADOS**

---

## 📊 Resumo Executivo

### ✅ O Que Já Está Pronto
- ✅ 215 migrations SQL criadas
- ✅ 86 Edge Functions implementadas
- ✅ Config.toml atualizado para novo projeto
- ✅ Backup completo realizado
- ✅ Documentação criada

### ⚠️ O Que Está Faltando
- ❌ **Cron Jobs não configurados** (pg_cron)
- ❌ **Storage/Buckets não migrados**
- ❌ **Secrets não configurados** (variáveis de ambiente)
- ❌ **Webhooks externos não atualizados**
- ❌ **Configuração Hetzner (se self-hosted)**
- ❌ **Dados não migrados** (apenas schema)

---

## 🚨 ITENS CRÍTICOS FALTANDO

### 1. CRON JOBS (pg_cron) ⚠️ CRÍTICO

**Status**: ⚠️ **SEMI-MIGRADO** - Funções existem mas cron jobs não estão configurados

#### Funções que Precisam de Cron Jobs:

1. **`sync-daily-metrics`** (verify_jwt = false)
   - Deve rodar diariamente
   - Cron necessário: `0 0 * * *` (meia-noite)

2. **`process-whatsapp-workflows`** (verify_jwt = false)
   - Deve rodar periodicamente (ex: a cada 5 minutos)
   - Cron necessário: `*/5 * * * *`

3. **`process-broadcast-queue`** (verify_jwt = false)
   - Deve rodar periodicamente
   - Cron necessário: `*/1 * * * *` (a cada minuto)

4. **`process-scheduled-messages`** (verify_jwt = false)
   - Deve rodar periodicamente
   - Cron necessário: `*/1 * * * *` (a cada minuto)

5. **`process-status-schedule`** (verify_jwt = false)
   - Deve rodar periodicamente
   - Cron necessário: `*/5 * * * *`

6. **`sync-google-calendar-events`** (verify_jwt = false)
   - Deve rodar periodicamente
   - Cron necessário: `*/15 * * * *` (a cada 15 minutos)

7. **`process-google-business-posts`** (verify_jwt = false)
   - Deve rodar periodicamente
   - Cron necessário: `*/30 * * * *` (a cada 30 minutos)

#### Como Configurar:

**Opção A: Via Supabase Dashboard (Cloud)**
1. Acesse: Dashboard → Database → Cron Jobs
2. Adicione cada job manualmente

**Opção B: Via SQL (Self-Hosted)**
```sql
-- Habilitar extensão pg_cron (se self-hosted)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Exemplo: Sync daily metrics (meia-noite)
SELECT cron.schedule(
  'sync-daily-metrics',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/sync-daily-metrics',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Exemplo: Process WhatsApp workflows (a cada 5 minutos)
SELECT cron.schedule(
  'process-whatsapp-workflows',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-whatsapp-workflows',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

**⚠️ IMPORTANTE**: 
- No Supabase Cloud, pg_cron pode ter limitações
- Verificar se extensão está habilitada
- Usar Service Role Key nos headers

---

### 2. STORAGE / BUCKETS ⚠️ CRÍTICO

**Status**: ❌ **NÃO MIGRADO** - Storage não foi verificado/migrado

#### O Que Verificar:

1. **Buckets Existentes**
   - Verificar buckets no projeto original
   - Criar buckets no novo projeto
   - Migrar arquivos (se houver)

2. **Políticas RLS de Storage**
   - Verificar políticas de acesso
   - Recriar políticas no novo projeto

#### Como Migrar:

```bash
# 1. Listar buckets do projeto original
supabase storage list --project-ref orcbxgajfhgmjobsjlix

# 2. Criar buckets no novo projeto
supabase storage create [nome-bucket] --project-ref ogeljmbhqxpfjbpnbwog

# 3. Migrar arquivos (se necessário)
# Usar Supabase Dashboard ou API
```

**⚠️ IMPORTANTE**: 
- Verificar se há arquivos importantes no storage
- Verificar políticas de acesso
- Testar upload/download após migração

---

### 3. SECRETS / VARIÁVEIS DE AMBIENTE ⚠️ CRÍTICO

**Status**: ❌ **NÃO CONFIGURADO** - Secrets precisam ser adicionados manualmente

#### Variáveis Críticas Identificadas:

**Supabase (Automáticas - Verificar)**
- `SUPABASE_URL` ✅ (automático)
- `SUPABASE_SERVICE_ROLE_KEY` ⚠️ (obter do Dashboard)
- `SUPABASE_ANON_KEY` ⚠️ (obter do Dashboard)

**Facebook/Instagram**
- `FACEBOOK_APP_ID=1616642309241531`
- `FACEBOOK_APP_SECRET=6513bcad61c0e9355d59cc31de243411`
- `FACEBOOK_CLIENT_TOKEN=ef4a74f7a245713f66688e19d2741516`
- `FACEBOOK_WEBHOOK_VERIFY_TOKEN` ⚠️ (gerar novo UUID)

**Google Services**
- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `GOOGLE_GMAIL_CLIENT_ID`
- `GOOGLE_GMAIL_CLIENT_SECRET`
- `GOOGLE_BUSINESS_CLIENT_ID`
- `GOOGLE_BUSINESS_CLIENT_SECRET`

**Outras Integrações**
- `CHATWOOT_API_URL`
- `CHATWOOT_API_TOKEN`
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `ASAAS_API_KEY`
- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`
- `N8N_API_URL`
- `N8N_API_KEY`
- `HUBSPOT_ACCESS_TOKEN`
- `BUBBLE_API_KEY`

#### Como Configurar:

1. Acesse: Dashboard → Settings → Edge Functions → Secrets
2. Adicione cada variável manualmente
3. **OU** use Supabase CLI:
```bash
supabase secrets set FACEBOOK_APP_ID=1616642309241531 --project-ref ogeljmbhqxpfjbpnbwog
```

**⚠️ IMPORTANTE**: 
- NUNCA commitar secrets no código
- Rotacionar credenciais após migração
- Documentar todas em local seguro

---

### 4. WEBHOOKS EXTERNOS ⚠️ CRÍTICO

**Status**: ❌ **NÃO ATUALIZADO** - URLs ainda apontam para projeto antigo

#### Serviços que Precisam Atualização:

1. **Facebook Developer**
   - Redirect URI: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/facebook-oauth-callback`
   - Webhook URL: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/facebook-webhook`

2. **Evolution API**
   - Webhook URL: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/evolution-webhook`

3. **Chatwoot**
   - Webhook URL: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/chatwoot-webhook`

4. **Mercado Pago**
   - Webhook URL: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/mercado-pago-webhook`

5. **Asaas**
   - Webhook URL: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/asaas-sync-boleto-status`

6. **Google Cloud Console**
   - Calendar Redirect: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/google-calendar-oauth-callback`
   - Gmail Redirect: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/gmail-oauth-callback`
   - Business Redirect: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/google-business-oauth-callback`

7. **HubSpot** (se usar)
   - Webhook URL: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/hubspot-webhook`

**⚠️ IMPORTANTE**: 
- Atualizar URLs em TODOS os serviços
- Testar cada webhook após atualização
- Manter projeto antigo ativo temporariamente

---

### 5. DADOS DO BANCO ⚠️ IMPORTANTE

**Status**: ⚠️ **SEMI-MIGRADO** - Apenas schema migrado, dados não

#### O Que Fazer:

**Se precisar migrar dados:**

1. **Exportar dados do projeto original**
```bash
supabase db dump --data-only --project-ref orcbxgajfhgmjobsjlix -f dados_export.sql
```

2. **Importar no novo projeto**
```bash
# Via SQL Editor no Dashboard
# OU via psql se tiver acesso direto
```

**⚠️ IMPORTANTE**: 
- Verificar se precisa migrar dados
- Alguns dados podem ser sensíveis (GDPR)
- Fazer backup antes de importar

---

### 6. CONFIGURAÇÃO HETZNER (Self-Hosted) ⚠️ CRÍTICO

**Status**: ❌ **NÃO CONFIGURADO** - Se optar por self-hosted

#### Passos para Hetzner:

**1. Criar Servidor**
- Tipo: CPX31 ou superior (4GB RAM mínimo)
- Sistema: Ubuntu 22.04 LTS
- Localização: Escolher mais próxima ao Brasil

**2. Instalar Docker e Docker Compose**
```bash
# No servidor Hetzner
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker
```

**3. Instalar Supabase Self-Hosted**
```bash
# Clonar repositório Supabase
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Copiar arquivo de exemplo
cp .env.example .env

# Editar .env com configurações
nano .env
```

**4. Configurações Importantes no .env:**
```bash
# Postgres
POSTGRES_PASSWORD=[SENHA_FORTE]
POSTGRES_DB=postgres

# API Keys
POSTGRES_HOST=db
POSTGRES_PORT=5432

# JWT
JWT_SECRET=[GERAR_UUID_FORTE]
JWT_EXPIRY=3600

# Anon Key e Service Role Key
# Gerar via: openssl rand -base64 32
ANON_KEY=[GERAR]
SERVICE_ROLE_KEY=[GERAR]

# API URL (usar IP público ou domínio)
API_URL=http://[IP_PUBLICO]:8000
# OU se tiver domínio:
API_URL=https://supabase.seudominio.com
```

**5. Iniciar Supabase**
```bash
docker-compose up -d
```

**6. Verificar Status**
```bash
docker-compose ps
# Todos os containers devem estar "Up"
```

**7. Configurar Domínio (Opcional mas Recomendado)**
```bash
# Instalar Nginx
sudo apt install -y nginx certbot python3-certbot-nginx

# Configurar Nginx como reverse proxy
# Editar /etc/nginx/sites-available/supabase
```

**8. Configurar SSL (Let's Encrypt)**
```bash
sudo certbot --nginx -d supabase.seudominio.com
```

**9. Aplicar Migrations**
```bash
# Linkar projeto local ao Supabase self-hosted
supabase link --project-ref [PROJECT_ID_LOCAL]

# OU aplicar migrations diretamente
supabase db push
```

**10. Deploy Edge Functions**
```bash
# Deploy de todas as funções
./scripts/deploy-todas-funcoes.sh
```

**⚠️ IMPORTANTE**: 
- Configurar firewall (apenas portas necessárias)
- Fazer backup regular do banco
- Monitorar recursos (CPU, RAM, disco)
- Configurar logs e monitoramento

---

## 📋 CHECKLIST COMPLETO DE MIGRAÇÃO

### Fase 1: Preparação ✅
- [x] Backup completo realizado
- [x] Config.toml atualizado
- [x] Documentação criada

### Fase 2: Banco de Dados ⏳
- [ ] Autenticar no Supabase CLI
- [ ] Aplicar migrations (215 arquivos)
- [ ] Verificar se todas foram aplicadas
- [ ] Migrar dados (se necessário)
- [ ] Verificar RLS policies

### Fase 3: Edge Functions ⏳
- [ ] Deploy de todas as funções (86 funções)
- [ ] Verificar se todas foram deployadas
- [ ] Testar funções críticas

### Fase 4: Configurações ⏳
- [ ] Configurar secrets/variáveis de ambiente
- [ ] Configurar cron jobs (pg_cron)
- [ ] Migrar storage/buckets
- [ ] Verificar políticas de storage

### Fase 5: Integrações Externas ⏳
- [ ] Atualizar URLs de webhooks
- [ ] Atualizar Redirect URIs OAuth
- [ ] Testar cada integração
- [ ] Validar autenticação OAuth

### Fase 6: Frontend ⏳
- [ ] Atualizar VITE_SUPABASE_URL
- [ ] Atualizar VITE_SUPABASE_PUBLISHABLE_KEY
- [ ] Regenerar types TypeScript
- [ ] Testar autenticação

### Fase 7: Hetzner (Se Self-Hosted) ⏳
- [ ] Criar servidor
- [ ] Instalar Docker
- [ ] Configurar Supabase self-hosted
- [ ] Configurar domínio e SSL
- [ ] Aplicar migrations
- [ ] Deploy de funções
- [ ] Configurar monitoramento

### Fase 8: Validação ⏳
- [ ] Testar todas as funcionalidades
- [ ] Testar webhooks
- [ ] Testar cron jobs
- [ ] Validar dados
- [ ] Monitorar logs por 24-48h

---

## 🚨 PRIORIDADES

### 🔴 CRÍTICO (Fazer Primeiro)
1. **Configurar Secrets** - Sem isso, funções não funcionam
2. **Configurar Cron Jobs** - Processos periódicos param
3. **Atualizar Webhooks** - Integrações externas quebram

### 🟡 IMPORTANTE (Fazer Depois)
4. **Migrar Storage** - Se houver arquivos importantes
5. **Migrar Dados** - Se necessário
6. **Configurar Hetzner** - Se optar por self-hosted

### 🟢 OPCIONAL (Pode Fazer Depois)
7. **Otimizações** - Performance, cache, etc.
8. **Monitoramento Avançado** - Logs, métricas, alertas

---

## 📚 Documentação de Referência

- `COMANDOS-MIGRACAO.md` - Comandos passo a passo
- `STATUS-MIGRACAO.md` - Status atual
- `VARIAVEIS-AMBIENTE-COMPLETAS.md` - Lista de variáveis
- `PLANO-MIGRACAO-SUPABASE-COMPLETO.md` - Plano completo
- `scripts/README.md` - Scripts disponíveis

---

**Última atualização**: 14/12/2025  
**Status**: ⚠️ **ITENS CRÍTICOS IDENTIFICADOS - AÇÃO NECESSÁRIA**

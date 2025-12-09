# 🚀 Checklist Completo de Deploy - Lovable Cloud

Este documento contém **TUDO** que precisa ser feito quando o código for para a nuvem no Lovable para garantir que o deploy funcione 100%.

---

## 📋 ÍNDICE

1. [Pré-requisitos](#1-pré-requisitos)
2. [Build e Compilação](#2-build-e-compilação)
3. [Migrations do Banco de Dados](#3-migrations-do-banco-de-dados)
4. [Edge Functions](#4-edge-functions)
5. [Variáveis de Ambiente](#5-variáveis-de-ambiente)
6. [Configurações do Supabase](#6-configurações-do-supabase)
7. [Verificações Finais](#7-verificações-finais)
8. [Testes Pós-Deploy](#8-testes-pós-deploy)

---

## 1️⃣ PRÉ-REQUISITOS

### ✅ Verificar Status do Git

```bash
# Verificar se está tudo commitado
git status

# Verificar se está sincronizado com a nuvem
git log --oneline -5
```

**Status esperado:**
- ✅ Working tree limpo (sem mudanças não commitadas)
- ✅ Branch `main` sincronizada com `origin/main`

---

## 2️⃣ BUILD E COMPILAÇÃO

### ✅ Instalar Dependências

```bash
cd agilize
npm install
```

**Verificar:**
- ✅ `node_modules/` criado
- ✅ Sem erros de instalação

### ✅ Build do Frontend

```bash
npm run build
```

**Verificar:**
- ✅ Pasta `dist/` criada
- ✅ Sem erros de compilação
- ✅ Arquivos estáticos gerados

**Se houver erros:**
- Verificar TypeScript errors
- Verificar imports faltando
- Verificar variáveis de ambiente não definidas

---

## 3️⃣ MIGRATIONS DO BANCO DE DADOS

### 📍 **Acesse:** https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/sql/new

### ⚠️ **IMPORTANTE:** Aplicar migrations na ordem cronológica!

### ✅ Migrations Principais (Ordem de Aplicação)

#### **Grupo 1: Estrutura Base**
- [ ] `20250101000000_add_chatwoot_create_leads_option.sql`
- [ ] `20250115000000_create_instance_health_metrics.sql`
- [ ] `20250115000001_create_instance_risk_score_function.sql`

#### **Grupo 2: Calendário e Gmail**
- [ ] `20250120000000_create_google_calendar_tables.sql`
- [ ] `20250121000000_create_calendar_message_templates.sql`
- [ ] `20250121000000_create_gmail_configs.sql`
- [ ] `20250122000000_add_stage_id_to_calendar_events.sql`

#### **Grupo 3: Follow-ups e Formulários**
- [ ] `20250122000000_create_follow_up_templates.sql`
- [ ] `20250122000001_add_follow_up_step_automations.sql`
- [ ] `20250124000000_create_form_builders.sql`

#### **Grupo 4: Pagamentos**
- [ ] `20250123000000_add_mercado_pago_config.sql`
- [ ] `20250123000001_add_mercado_pago_payments.sql`
- [ ] `20251115010000_add_asaas_config.sql`
- [ ] `20251115020000_add_boleto_tracking.sql`

#### **Grupo 5: Facebook/Instagram**
- [ ] `20250124000000_create_facebook_configs.sql`
- [ ] `20250125000000_create_facebook_configs.sql` (se diferente)

#### **Grupo 6: Automações e Workflows**
- [ ] `20250125000000_create_automation_flows.sql`
- [ ] `20250126000000_add_lead_tags_rls_policies.sql`
- [ ] `20251114130000_add_whatsapp_workflows.sql`
- [ ] `20251114140000_add_workflow_approval_and_contact_files.sql`
- [ ] `20251115000000_add_workflow_groups.sql`
- [ ] `20251115000001_add_monthly_attachments.sql`
- [ ] `20251115000002_update_workflows_for_groups.sql`
- [ ] `20251128000000_fix_workflow_list_id_for_groups.sql`

#### **Grupo 7: Google Business**
- [ ] `20250126000000_create_google_business_tables.sql`

#### **Grupo 8: Pós-Venda**
- [ ] `20250127000000_create_post_sale_leads.sql`

#### **Grupo 9: Status WhatsApp**
- [ ] `20250128000000_create_whatsapp_status_posts.sql`

#### **Grupo 10: N8n Integration**
- [ ] `20250129000000_create_n8n_config.sql`

#### **Grupo 11: Sistema de Planos e Limites**
- [ ] `20250130000000_create_organization_limits.sql`
- [ ] `20250130000001_add_limit_validations.sql`
- [ ] `20250130000002_create_plans_system.sql`
- [ ] `20250130000003_update_get_organizations_rpc.sql`
- [ ] `20250130000004_refine_permissions_system.sql`

#### **Grupo 12: Leads e Funnel**
- [ ] `20250128000000_add_excluded_from_funnel.sql`
- [ ] `20250128000001_update_create_lead_secure_excluded.sql`

#### **Grupo 13: Migrations Remix (Batch)**
- [ ] `20251106174217_remix_batch_1_migrations.sql`
- [ ] Aplicar todas as migrations numeradas de `20251106` até `20251209` na ordem cronológica

### 📝 **Como Aplicar:**

1. Abra cada arquivo SQL na ordem listada acima
2. Copie **TODO o conteúdo** do arquivo
3. Cole no **SQL Editor** do Supabase Dashboard
4. Clique em **RUN**
5. Verifique se não houve erros
6. Repita para o próximo arquivo

### ✅ **Verificar Migrations Aplicadas:**

```sql
-- Execute no SQL Editor para ver todas as migrations aplicadas
SELECT 
  version,
  name,
  inserted_at
FROM supabase_migrations.schema_migrations
ORDER BY inserted_at DESC;
```

---

## 4️⃣ EDGE FUNCTIONS

### 📍 **Acesse:** https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/functions

### ✅ **Lista Completa de Edge Functions para Deploy:**

#### **Grupo 1: WhatsApp e Evolution**
- [ ] `evolution-fetch-chats`
- [ ] `evolution-fetch-messages`
- [ ] `evolution-send-message-direct`
- [ ] `evolution-webhook`
- [ ] `send-whatsapp-message`
- [ ] `validate-whatsapp-number`
- [ ] `create-evolution-instance`

#### **Grupo 2: Workflows WhatsApp**
- [ ] `process-whatsapp-workflows`
- [ ] `publish-whatsapp-status`
- [ ] `process-status-schedule`

#### **Grupo 3: Broadcast e Campanhas**
- [ ] `process-broadcast-queue`
- [ ] `process-scheduled-messages`

#### **Grupo 4: Chatwoot**
- [ ] `chatwoot-proxy`
- [ ] `chatwoot-add-private-note`
- [ ] `chatwoot-apply-label`
- [ ] `chatwoot-create-canned-response`
- [ ] `chatwoot-create-contact`
- [ ] `chatwoot-create-conversation`
- [ ] `chatwoot-create-label`
- [ ] `chatwoot-execute-macro`
- [ ] `chatwoot-get-conversations`
- [ ] `chatwoot-get-messages`
- [ ] `chatwoot-list-canned-responses`
- [ ] `chatwoot-list-inboxes`
- [ ] `chatwoot-list-labels`
- [ ] `chatwoot-merge-contacts`
- [ ] `chatwoot-send-message`
- [ ] `chatwoot-test-connection`
- [ ] `chatwoot-webhook`

#### **Grupo 5: Google Calendar**
- [ ] `google-calendar-oauth-init`
- [ ] `google-calendar-oauth-callback`
- [ ] `sync-google-calendar-events`
- [ ] `list-google-calendars`
- [ ] `get-google-calendar-access-token`
- [ ] `create-google-calendar-event`
- [ ] `update-google-calendar-event`
- [ ] `delete-google-calendar-event`

#### **Grupo 6: Gmail**
- [ ] `gmail-oauth-init`
- [ ] `gmail-oauth-callback`
- [ ] `list-gmail-messages`
- [ ] `gmail-send-reply`

#### **Grupo 7: Facebook/Instagram**
- [ ] `facebook-oauth-init`
- [ ] `facebook-oauth-callback`
- [ ] `facebook-test-connection`
- [ ] `facebook-webhook`

#### **Grupo 8: Google Business**
- [ ] `google-business-oauth-init`
- [ ] `google-business-oauth-callback`
- [ ] `get-google-business-access-token`
- [ ] `create-google-business-post`
- [ ] `process-google-business-posts`

#### **Grupo 9: Formulários**
- [ ] `get-form`
- [ ] `submit-form`

#### **Grupo 10: Pagamentos**
- [ ] `mercado-pago-create-boleto`
- [ ] `mercado-pago-create-payment`
- [ ] `mercado-pago-webhook`
- [ ] `asaas-create-boleto`
- [ ] `asaas-create-charge`
- [ ] `asaas-sync-boleto-status`

#### **Grupo 11: N8n**
- [ ] `n8n-generate-workflow`
- [ ] `n8n-proxy`

#### **Grupo 12: Agentes IA**
- [ ] `agents-sync-evolution`
- [ ] `agents-sync-openai`
- [ ] `openai-list-models`

#### **Grupo 13: Bubble Integration**
- [ ] `bubble-check-status`
- [ ] `bubble-list-data-types`
- [ ] `bubble-list-instances`
- [ ] `bubble-query-data`
- [ ] `bubble-send-whatsapp`
- [ ] `bubble-sync-leads`

#### **Grupo 14: Utilitários**
- [ ] `create-user`
- [ ] `import-contacts`
- [ ] `log-auth-attempt`
- [ ] `patch-call-queue-org`
- [ ] `sync-daily-metrics`
- [ ] `apply-fix-recipient-type`

### 📝 **Como Fazer Deploy:**

1. No Dashboard, clique em **Create a new function** (ou edite se já existe)
2. Nome: Use o nome exato da função (ex: `evolution-webhook`)
3. Abra o arquivo: `supabase/functions/[nome-da-funcao]/index.ts`
4. Copie **TODO o conteúdo** do arquivo
5. Cole no editor da função no Dashboard
6. Clique em **Deploy**
7. Verifique se aparece como "Active"
8. Repita para todas as funções

### ✅ **Verificar Deploy:**

- [ ] Todas as funções aparecem na lista com status "Active"
- [ ] Testar algumas funções principais clicando em **Invoke**

---

## 5️⃣ VARIÁVEIS DE AMBIENTE

### 📍 **Acesse:** https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/settings/functions

### ✅ **Variáveis Obrigatórias:**

#### **Facebook/Instagram**
- [ ] `FACEBOOK_APP_ID` = `1616642309241531`
- [ ] `FACEBOOK_APP_SECRET` = `6513bcad61c0e9355d59cc31de243411`
- [ ] `FACEBOOK_CLIENT_TOKEN` = `ef4a74f7a245713f66688e19d2741516`
- [ ] `FACEBOOK_WEBHOOK_VERIFY_TOKEN` = (gerar UUID único e secreto)

#### **WhatsApp (Modo Teste - Opcional)**
- [ ] `TEST_MODE` = `true` ou `false` (opcional)
- [ ] `WHATSAPP_TEST_PHONE` = (número de teste, opcional)
- [ ] `WHATSAPP_LOG_ONLY` = `true` ou `false` (opcional)

#### **N8n (Se usar)**
- [ ] `N8N_API_URL` = (URL da sua instância N8n)
- [ ] `N8N_API_KEY` = (chave de API do N8n)

#### **Mercado Pago (Se usar)**
- [ ] `MERCADO_PAGO_ACCESS_TOKEN` = (token de acesso)
- [ ] `MERCADO_PAGO_PUBLIC_KEY` = (chave pública)

#### **Asaas (Se usar)**
- [ ] `ASAAS_API_KEY` = (chave de API)
- [ ] `ASAAS_API_URL` = `https://api.asaas.com/v3`

#### **OpenAI (Se usar Agentes IA)**
- [ ] `OPENAI_API_KEY` = (chave de API)

### 📝 **Como Adicionar:**

1. No Dashboard, vá em **Settings** → **Edge Functions** → **Secrets**
2. Clique em **Add new secret**
3. Nome: (ex: `FACEBOOK_APP_ID`)
4. Valor: (cole o valor)
5. Clique em **Save**
6. Repita para todas as variáveis

---

## 6️⃣ CONFIGURAÇÕES DO SUPABASE

### ✅ **Config.toml**

Verificar se o arquivo `supabase/config.toml` está correto:

- [ ] `project_id` = `orcbxgajfhgmjobsjlix`
- [ ] Todas as funções têm `verify_jwt` configurado corretamente

### ✅ **RLS (Row Level Security)**

Verificar se as políticas RLS estão aplicadas:

- [ ] Executar migrations que criam políticas RLS
- [ ] Verificar se usuários conseguem acessar seus dados

### ✅ **Storage Buckets**

Verificar se os buckets necessários existem:

- [ ] `whatsapp-workflow-media` (para anexos de workflows)
- [ ] Outros buckets conforme necessário

**Criar bucket se não existir:**

```sql
-- Execute no SQL Editor
INSERT INTO storage.buckets (id, name, public) 
VALUES ('whatsapp-workflow-media', 'whatsapp-workflow-media', true)
ON CONFLICT DO NOTHING;
```

### ✅ **Cron Jobs (Opcional)**

Se precisar de execução automática:

- [ ] `process-whatsapp-workflows` (a cada 5 minutos)
- [ ] `process-status-schedule` (a cada minuto)
- [ ] `sync-daily-metrics` (diariamente)
- [ ] Outros conforme necessário

**Criar Cron Job:**

```sql
-- Habilitar extensão
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Exemplo: process-whatsapp-workflows (a cada 5 minutos)
SELECT cron.schedule(
  'process-whatsapp-workflows',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://orcbxgajfhgmjobsjlix.supabase.co/functions/v1/process-whatsapp-workflows',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SEU_SERVICE_ROLE_KEY_AQUI'
    )
  );
  $$
);
```

**Para pegar SERVICE_ROLE_KEY:**
- Dashboard → **Settings** → **API** → Role: `service_role`

---

## 7️⃣ VERIFICAÇÕES FINAIS

### ✅ **Verificar Tabelas Criadas**

```sql
-- Execute no SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**Tabelas principais que devem existir:**
- [ ] `organizations`
- [ ] `leads`
- [ ] `form_builders`
- [ ] `form_submissions`
- [ ] `whatsapp_workflows`
- [ ] `whatsapp_workflow_lists`
- [ ] `whatsapp_status_posts`
- [ ] `post_sale_leads`
- [ ] `follow_up_templates`
- [ ] `n8n_configs`
- [ ] E outras conforme migrations aplicadas

### ✅ **Verificar Funções RPC**

```sql
-- Execute no SQL Editor
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

### ✅ **Verificar Edge Functions**

- [ ] Todas as funções listadas na seção 4 estão deployadas
- [ ] Status: "Active"
- [ ] Sem erros nos logs

### ✅ **Verificar Variáveis de Ambiente**

- [ ] Todas as variáveis obrigatórias estão configuradas
- [ ] Valores corretos (sem espaços extras)

---

## 8️⃣ TESTES PÓS-DEPLOY

### ✅ **Testes Básicos**

1. **Login:**
   - [ ] Conseguir fazer login
   - [ ] Sessão persiste após refresh

2. **Dashboard:**
   - [ ] Dashboard carrega sem erros
   - [ ] Métricas aparecem

3. **Leads:**
   - [ ] Lista de leads carrega
   - [ ] Criar novo lead funciona
   - [ ] Editar lead funciona

4. **WhatsApp:**
   - [ ] Lista de conversas carrega
   - [ ] Enviar mensagem funciona
   - [ ] Webhook recebe mensagens

5. **Formulários:**
   - [ ] Criar formulário funciona
   - [ ] Preview funciona
   - [ ] Código de embed gera corretamente
   - [ ] Submissão de formulário cria lead

6. **Workflows:**
   - [ ] Criar workflow funciona
   - [ ] Criar lista funciona
   - [ ] Processar workflow funciona

7. **Pós-Venda:**
   - [ ] Lista de leads pós-venda carrega
   - [ ] Aplicar follow-up funciona

### ✅ **Testes de Edge Functions**

Testar algumas funções principais:

```bash
# Via Dashboard: Edge Functions → [função] → Invoke

# Ou via curl (substitua SEU_ANON_KEY):
curl -X POST \
  'https://orcbxgajfhgmjobsjlix.supabase.co/functions/v1/get-form' \
  -H 'Authorization: Bearer SEU_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"form_id": "teste"}'
```

### ✅ **Verificar Logs**

- [ ] Dashboard → **Edge Functions** → **Logs**
- [ ] Verificar se há erros
- [ ] Verificar se funções estão sendo chamadas

---

## 🎯 RESUMO RÁPIDO

### **O que fazer quando o código vai para a nuvem:**

1. ✅ **Build:** `npm install && npm run build`
2. ✅ **Migrations:** Aplicar todas as migrations na ordem cronológica
3. ✅ **Edge Functions:** Deploy de todas as funções
4. ✅ **Variáveis:** Configurar todas as variáveis de ambiente
5. ✅ **Verificar:** Tabelas, funções, buckets criados
6. ✅ **Testar:** Funcionalidades principais

### **Tempo estimado:** 2-3 horas (primeira vez) | 30-60 minutos (atualizações)

---

## 🆘 PROBLEMAS COMUNS

### **Erro: "relation does not exist"**
- ✅ Solução: Aplicar migrations faltando

### **Erro: "function does not exist"**
- ✅ Solução: Deploy da Edge Function faltando

### **Erro: "bucket does not exist"**
- ✅ Solução: Criar bucket via SQL

### **Erro: "environment variable not found"**
- ✅ Solução: Adicionar variável em Settings → Edge Functions → Secrets

### **Erro: "JWT verification failed"**
- ✅ Solução: Verificar `verify_jwt` no `config.toml`

---

## 📞 PRÓXIMOS PASSOS

Após o deploy completo:

1. Monitorar logs regularmente
2. Configurar alertas (se disponível)
3. Documentar processos específicos
4. Treinar equipe nas novas funcionalidades

---

**✅ Checklist criado em:** 2025-01-XX  
**📝 Última atualização:** 2025-01-XX  
**🔄 Versão:** 1.0


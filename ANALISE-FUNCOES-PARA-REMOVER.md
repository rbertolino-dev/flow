# 🗑️ Análise de Edge Functions - Funções que Podem Ser Removidas

## ⚠️ ATENÇÃO: Atingiu o Limite de Funções no Supabase

Este documento lista as funções que **podem ser removidas com segurança** após verificação.

---

## 📋 Categorias de Funções

### ✅ **FUNÇÕES CRÍTICAS (NÃO REMOVER)**
Estas funções são essenciais e estão em uso ativo:

#### **Cron Jobs (Automáticos):**
- ✅ `process-broadcast-queue` - Processa fila de broadcast (cron a cada minuto)
- ✅ `process-scheduled-messages` - Processa mensagens agendadas (cron a cada minuto)
- ✅ `process-scheduled-campaigns` - Processa campanhas agendadas (cron a cada minuto) ⚠️ **NOVA**
- ✅ `process-whatsapp-workflows` - Processa workflows WhatsApp (cron a cada 5 min)
- ✅ `process-status-schedule` - Processa agendamento de status (cron a cada 5 min)
- ✅ `sync-daily-metrics` - Sincroniza métricas diárias (cron meia-noite)
- ✅ `sync-google-calendar-events` - Sincroniza Google Calendar (cron a cada 15 min)
- ✅ `process-google-business-posts` - Processa posts Google Business (cron a cada 30 min)

#### **Webhooks (Chamadas Externas):**
- ✅ `evolution-webhook` - Webhook do Evolution API (chamado externamente)
- ✅ `chatwoot-webhook` - Webhook do Chatwoot (chamado externamente)
- ✅ `facebook-webhook` - Webhook do Facebook/Instagram (chamado externamente)
- ✅ `mercado-pago-webhook` - Webhook do Mercado Pago (chamado externamente)
- ✅ `bubble-usage-webhook` - Webhook do Bubble.io (chamado externamente)
- ✅ `hubspot-webhook` - Webhook do HubSpot (chamado externamente)
- ✅ `asaas-sync-boleto-status` - Sincroniza status de boletos (cron)

#### **OAuth Callbacks (Chamadas Externas):**
- ✅ `google-calendar-oauth-callback` - Callback OAuth Google Calendar
- ✅ `google-business-oauth-callback` - Callback OAuth Google Business
- ✅ `facebook-oauth-callback` - Callback OAuth Facebook
- ✅ `gmail-oauth-callback` - Callback OAuth Gmail
- ✅ `google-drive-oauth` - OAuth Google Drive (usado em contratos)

#### **Funções Usadas no Frontend:**
- ✅ `send-whatsapp-message` - Envia mensagens WhatsApp (usado em múltiplos componentes)
- ✅ `create-evolution-instance` - Cria instância Evolution (usado no frontend)
- ✅ `reconnect-evolution-instance` - Reconecta instância (usado no frontend)
- ✅ `approve-booking` - Aprova agendamento (usado no frontend)
- ✅ `get-availability` - Busca disponibilidade (usado em PublicBooking)
- ✅ `create-booking-request` - Cria solicitação de agendamento (usado em PublicBooking)
- ✅ `send-booking-confirmation` - Envia confirmação (chamado por approve-booking)
- ✅ `create-google-calendar-event` - Cria evento Google Calendar (usado no frontend)
- ✅ `update-google-calendar-event` - Atualiza evento Google Calendar (usado no frontend)
- ✅ `delete-google-calendar-event` - Deleta evento Google Calendar (usado no frontend)
- ✅ `send-budget-whatsapp` - Envia orçamento WhatsApp (usado em Budgets.tsx)
- ✅ `send-contract-whatsapp` - Envia contrato WhatsApp (usado em Contracts.tsx)
- ✅ `send-contract-signed` - Envia contrato assinado (usado em SendContractDialog)
- ✅ `agents-sync-openai` - Sincroniza agentes OpenAI (usado em AgentManager)
- ✅ `agents-sync-evolution` - Sincroniza agentes Evolution (usado em AgentManager)
- ✅ `bubble-query-data` - Consulta dados Bubble (usado em useBubbleQueries)
- ✅ `bubble-sync-leads` - Sincroniza leads Bubble (usado em useBubbleLeadsSync)
- ✅ `bubble-send-whatsapp` - Envia WhatsApp via Bubble (webhook)
- ✅ `patch-call-queue-org` - Atualiza fila de chamadas (usado em useCallQueue)
- ✅ `create-user` - Cria usuário (usado em CreateUserDialog)
- ✅ `deepseek-assistant` - Assistente DeepSeek (usado em useAssistant)
- ✅ `products` - Lista produtos (usado em useOnboarding)
- ✅ `n8n-proxy` - Proxy N8n (usado em useN8nConfig)
- ✅ `chatwoot-proxy` - Proxy Chatwoot (usado no sistema)

---

## 🗑️ **FUNÇÕES QUE PODEM SER REMOVIDAS (SEGURAS)**

### **1. Funções de Migração (Temporárias - Já Executadas)**

Estas funções foram usadas para migrações e podem ser removidas:

- ❌ `add-digital-contracts-feature` - Migração de contratos digitais
- ❌ `apply-broadcast-migration` - Migração de broadcast
- ❌ `apply-budgets-migration` - Migração de orçamentos
- ❌ `apply-budgets-migration-auto` - Migração automática de orçamentos
- ❌ `apply-contracts-fix` - Correção de contratos
- ❌ `apply-fix-recipient-type` - Correção de tipo de destinatário
- ❌ `apply-onboarding-fix` - Correção de onboarding
- ❌ `apply-organization-limits-fix` - Correção de limites de organização
- ❌ `apply-rls-migration` - Migração RLS
- ❌ `apply-survey-migration` - Migração de pesquisas
- ❌ `migrate-products` - Migração de produtos

**Total: 11 funções**

---

### **2. Funções de Teste/Validação (Não Essenciais)**

Estas funções são apenas para testes e podem ser removidas se não estiverem em uso:

- ❌ `bubble-check-status` - Verifica status Bubble (teste)
- ❌ `chatwoot-test-connection` - Testa conexão Chatwoot (teste)
- ❌ `check-campaign-health` - Verifica saúde de campanhas (teste)
- ❌ `facebook-test-connection` - Testa conexão Facebook (teste)
- ❌ `get-deployment-status` - Status de deploy (teste)
- ❌ `hubspot-test-connection` - Testa conexão HubSpot (teste)
- ❌ `validate-whatsapp-number` - Valida número WhatsApp (pode ser feito no frontend)

**Total: 7 funções**

---

### **3. Funções Não Utilizadas (Verificar Antes de Remover)**

Estas funções não foram encontradas em uso no código, mas **verifique antes de remover**:

#### **OAuth Init (Pode estar em uso):**
- ⚠️ `google-calendar-oauth-init` - Inicia OAuth Google Calendar (verificar se usado)
- ⚠️ `google-business-oauth-init` - Inicia OAuth Google Business (verificar se usado)
- ⚠️ `facebook-oauth-init` - Inicia OAuth Facebook (verificar se usado)
- ⚠️ `gmail-oauth-init` - Inicia OAuth Gmail (verificar se usado)

#### **Chatwoot (Pode estar em uso):**
- ⚠️ `chatwoot-add-private-note` - Adiciona nota privada Chatwoot
- ⚠️ `chatwoot-create-canned-response` - Cria resposta pronta Chatwoot
- ⚠️ `chatwoot-create-contact` - Cria contato Chatwoot
- ⚠️ `chatwoot-create-conversation` - Cria conversa Chatwoot
- ⚠️ `chatwoot-create-label` - Cria label Chatwoot
- ⚠️ `chatwoot-execute-macro` - Executa macro Chatwoot
- ⚠️ `chatwoot-get-conversations` - Busca conversas Chatwoot
- ⚠️ `chatwoot-get-messages` - Busca mensagens Chatwoot
- ⚠️ `chatwoot-list-canned-responses` - Lista respostas prontas Chatwoot
- ⚠️ `chatwoot-list-inboxes` - Lista inboxes Chatwoot
- ⚠️ `chatwoot-list-labels` - Lista labels Chatwoot
- ⚠️ `chatwoot-merge-contacts` - Mescla contatos Chatwoot
- ⚠️ `chatwoot-send-message` - Envia mensagem Chatwoot

#### **Google Calendar (Pode estar em uso):**
- ⚠️ `list-google-calendars` - Lista calendários Google
- ⚠️ `get-google-calendar-access-token` - Busca token de acesso Google Calendar

#### **Gmail (Pode estar em uso):**
- ⚠️ `list-gmail-messages` - Lista mensagens Gmail
- ⚠️ `gmail-send-reply` - Envia resposta Gmail

#### **Google Business (Pode estar em uso):**
- ⚠️ `get-google-business-access-token` - Busca token de acesso Google Business

#### **Facebook/Instagram (Pode estar em uso):**
- ⚠️ `facebook-test-connection` - Testa conexão Facebook (já listado acima)

#### **Formulários e Pesquisas (Pode estar em uso):**
- ⚠️ `get-form` - Busca formulário (usado em formulários públicos?)
- ⚠️ `submit-form` - Submete formulário (usado em formulários públicos?)
- ⚠️ `get-survey` - Busca pesquisa (usado em PublicSurvey?)
- ⚠️ `submit-survey` - Submete pesquisa (usado em PublicSurvey?)

#### **Pagamentos (Pode estar em uso):**
- ⚠️ `mercado-pago-create-boleto` - Cria boleto Mercado Pago
- ⚠️ `asaas-create-boleto` - Cria boleto Asaas
- ⚠️ `asaas-create-charge` - Cria cobrança Asaas

#### **N8n (Pode estar em uso):**
- ⚠️ `n8n-generate-workflow` - Gera workflow N8n

#### **Bubble (Pode estar em uso):**
- ⚠️ `bubble-list-data-types` - Lista tipos de dados Bubble
- ⚠️ `bubble-list-instances` - Lista instâncias Bubble

#### **OpenAI (Pode estar em uso):**
- ⚠️ `openai-list-models` - Lista modelos OpenAI

#### **Utilitários (Pode estar em uso):**
- ⚠️ `import-contacts` - Importa contatos
- ⚠️ `log-auth-attempt` - Registra tentativa de autenticação
- ⚠️ `public-signup` - Cadastro público
- ⚠️ `update-user-password` - Atualiza senha de usuário
- ⚠️ `disable-email-confirmation` - Desabilita confirmação de email

#### **Colaboradores (Pode estar em uso):**
- ⚠️ `employees` - Gerencia funcionários
- ⚠️ `employee-benefits` - Benefícios de funcionários
- ⚠️ `employee-dependents` - Dependentes de funcionários
- ⚠️ `employee-documents` - Documentos de funcionários
- ⚠️ `employee-history` - Histórico de funcionários
- ⚠️ `positions` - Cargos
- ⚠️ `teams` - Times

#### **Orçamentos e Contratos (Pode estar em uso):**
- ⚠️ `get-services` - Busca serviços (usado em orçamentos?)
- ⚠️ `send-budget-whatsapp-module` - Envia orçamento WhatsApp (módulo)
- ⚠️ `generate-budget-pdf-module` - Gera PDF de orçamento (módulo)
- ⚠️ `generate-contract-pdf` - Gera PDF de contrato
- ⚠️ `send-contract-reminder` - Envia lembrete de contrato (cron?)
- ⚠️ `contract-backup-daily` - Backup diário de contratos (cron?)

#### **HubSpot (Pode estar em uso):**
- ⚠️ `hubspot-get-list-contacts` - Busca contatos de lista HubSpot
- ⚠️ `hubspot-import-list` - Importa lista HubSpot
- ⚠️ `hubspot-list-lists` - Lista listas HubSpot
- ⚠️ `hubspot-sync-contacts` - Sincroniza contatos HubSpot

#### **Evolution (Pode estar em uso):**
- ⚠️ `evolution-fetch-chats` - Busca chats Evolution
- ⚠️ `evolution-fetch-messages` - Busca mensagens Evolution
- ⚠️ `evolution-send-message-direct` - Envia mensagem direta Evolution
- ⚠️ `publish-whatsapp-status` - Publica status WhatsApp
- ⚠️ `notify-instance-disconnection` - Notifica desconexão de instância

#### **Utilitários SQL (CUIDADO):**
- ⚠️ `execute-sql-direct` - Executa SQL direto (PERIGOSO - verificar se usado)

---

## 📊 **Resumo de Remoção Segura**

### **✅ REMOVER COM SEGURANÇA (18 funções):**

**Migrações (11 funções):**
1. `add-digital-contracts-feature`
2. `apply-broadcast-migration`
3. `apply-budgets-migration`
4. `apply-budgets-migration-auto`
5. `apply-contracts-fix`
6. `apply-fix-recipient-type`
7. `apply-onboarding-fix`
8. `apply-organization-limits-fix`
9. `apply-rls-migration`
10. `apply-survey-migration`
11. `migrate-products`

**Testes/Validação (7 funções):**
12. `bubble-check-status`
13. `chatwoot-test-connection`
14. `check-campaign-health`
15. `facebook-test-connection`
16. `get-deployment-status`
17. `hubspot-test-connection`
18. `validate-whatsapp-number`

---

## 🔍 **Como Verificar Antes de Remover**

### **1. Verificar se função está em uso:**

```bash
# Buscar no código
grep -r "nome-da-funcao" src/
grep -r "nome-da-funcao" supabase/

# Verificar se tem cron job
grep -r "nome-da-funcao" CRON-JOBS-FINAL.sql
```

### **2. Verificar logs no Supabase:**
- Dashboard → Edge Functions → [nome-da-funcao] → Logs
- Se não houver logs recentes (últimos 30 dias), provavelmente não está em uso

### **3. Verificar webhooks externos:**
- Se for webhook, verificar se está configurado em serviços externos
- Se for OAuth callback, verificar se está configurado no provedor OAuth

---

## ⚠️ **RECOMENDAÇÃO FINAL**

**Remover primeiro as 18 funções listadas acima** (migrações + testes).

Isso deve liberar espaço suficiente. Se ainda precisar de mais espaço, verificar as funções marcadas com ⚠️ uma por uma antes de remover.

---

## 📝 **Checklist Antes de Remover**

- [ ] Verificar se função não está em uso no código
- [ ] Verificar se função não tem cron job configurado
- [ ] Verificar se função não é webhook configurado externamente
- [ ] Verificar logs no Supabase (últimos 30 dias)
- [ ] Fazer backup do código da função (caso precise restaurar)
- [ ] Remover função no Dashboard do Supabase
- [ ] Remover função local (opcional, mas recomendado)

---

**Data de criação:** 22/01/2026  
**Total de funções locais:** ~130  
**Funções que podem ser removidas com segurança:** 18  
**Economia estimada:** ~14% do limite

# 🔍 Função de Agendar Disparos - Verificação

## ✅ Função Encontrada: `process-scheduled-campaigns`

**Esta é a função que agenda disparos de campanhas automaticamente!**

### 📍 Localização:
- **Arquivo:** `supabase/functions/process-scheduled-campaigns/index.ts`
- **Status Local:** ✅ Existe (7.9K)
- **Status Deploy:** ❓ Precisa verificar no Supabase

### 🎯 O que esta função faz:

1. **Verifica a cada minuto** (via cron job) se há campanhas agendadas
2. **Busca campanhas** com:
   - `status = 'draft'`
   - `scheduled_start_at` preenchido
   - `scheduled_start_at <= agora` (horário já passou)
3. **Inicia campanhas automaticamente:**
   - Agenda mensagens na fila `broadcast_queue`
   - Atualiza status da campanha para `running`
   - Limpa `scheduled_start_at` após iniciar

### 🔗 Funções Relacionadas:

1. **`process-scheduled-campaigns`** - Inicia campanhas agendadas (esta função)
2. **`process-broadcast-queue`** - Processa e envia mensagens da fila (chamada depois)
3. **`scheduleCampaignMessages`** (frontend) - Agenda mensagens quando usuário inicia campanha

### 📋 Fluxo Completo:

```
Usuário agenda campanha
    ↓
Frontend salva scheduled_start_at no banco
    ↓
process-scheduled-campaigns (a cada minuto):
  - Detecta campanha agendada
  - Agenda mensagens na fila
  - Marca campanha como running
    ↓
process-broadcast-queue (a cada minuto):
  - Processa mensagens agendadas
  - Envia via WhatsApp
```

---

## 🗑️ Funções que Podem Ser Removidas

### ✅ REMOVER COM SEGURANÇA (18 funções):

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

## ✅ Função de Agendar Disparos

**Nome:** `process-scheduled-campaigns`

**Status:**
- ✅ Existe localmente
- ❓ Precisa verificar se está deployada no Supabase

**Como verificar se está deployada:**
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions
2. Procure por `process-scheduled-campaigns`
3. Se não aparecer, precisa fazer deploy

**Como fazer deploy:**
- Veja: `GUIA-DEPLOY-PROCESS-SCHEDULED-CAMPAIGNS.md`


# ✅ Próximos Passos - Cron Jobs

**Status Atual**: ✅ Extensões `http` e `pg_net` habilitadas com sucesso!

---

## 🚀 Passo 1: Criar os Cron Jobs (AGORA)

Agora que as extensões estão habilitadas, você pode criar os cron jobs:

### Como Fazer:

1. **Acesse o SQL Editor:**
   - URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

2. **Execute o arquivo:** `CRON-JOBS-FINAL.sql`
   - Copie TODO o conteúdo
   - Cole no SQL Editor
   - Execute (RUN)

3. **Verificar se funcionou:**
   - Execute: `VERIFICAR-CRON-JOBS.sql`
   - Você deve ver **7 cron jobs** criados

---

## 📋 Cron Jobs que Serão Criados:

1. ✅ `sync-daily-metrics` - `0 0 * * *` (meia-noite)
2. ✅ `process-whatsapp-workflows` - `*/5 * * * *` (a cada 5 min)
3. ✅ `process-broadcast-queue` - `*/1 * * * *` (a cada minuto)
4. ✅ `process-scheduled-messages` - `*/1 * * * *` (a cada minuto)
5. ✅ `process-status-schedule` - `*/5 * * * *` (a cada 5 min)
6. ✅ `sync-google-calendar-events` - `*/15 * * * *` (a cada 15 min)
7. ✅ `process-google-business-posts` - `*/30 * * * *` (a cada 30 min)

---

## ✅ Passo 2: Verificar Cron Jobs

Após executar `CRON-JOBS-FINAL.sql`, execute `VERIFICAR-CRON-JOBS.sql` para confirmar:

- ✅ `total_jobs`: **7** (ou mais se já existiam outros)
- ✅ Lista de 7 cron jobs com seus schedules
- ✅ Todos com `active = true`

---

## 🎯 Passo 3: Próxima Tarefa - Webhooks Externos

Após confirmar que os cron jobs estão funcionando, o próximo passo é:

### Atualizar Webhooks Externos (10-15 min)

**Webhooks que precisam ser atualizados:**

1. **Evolution API Webhooks**
   - URL: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/evolution-webhook`
   - Configurar em cada instância do Evolution API

2. **Chatwoot Webhooks**
   - URL: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/chatwoot-webhook`
   - Configurar no Chatwoot Dashboard

3. **Facebook Webhooks**
   - URL: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/facebook-webhook`
   - Configurar no Facebook Developer Console

4. **Mercado Pago Webhooks**
   - URL: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/mercado-pago-webhook`
   - Configurar no Mercado Pago Dashboard

---

## 📊 Status Geral da Migração

- ✅ **Migrations**: 210/220 (95%)
- ✅ **Edge Functions**: 85/85 (100%)
- ✅ **Secrets**: 8/8 (100%)
- ✅ **Frontend (.env)**: 3/3 (100%)
- ✅ **Extensões**: http + pg_net (100%)
- ⏳ **Cron Jobs**: Em andamento (extensões OK, criar jobs)
- ⏳ **Webhooks**: Pendente (próximo passo)

---

**Última atualização**: 15/12/2025 01:40




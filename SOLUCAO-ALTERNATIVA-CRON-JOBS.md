# 🔧 Solução Alternativa para Cron Jobs

**Problema Identificado**: `ERRO: o esquema "net" não existe`

A extensão `http` não está disponível ou habilitada no Supabase Cloud.

---

## ✅ Solução 1: Habilitar Extensão HTTP (Tentar Primeiro)

### Passo 1: Executar SQL para Habilitar Extensão
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Execute o arquivo: `HABILITAR-EXTENSAO-HTTP.sql`
3. Verifique se a extensão foi habilitada

### Passo 2: Se HTTP Funcionar
- Execute novamente: `CRON-JOBS-FINAL.sql`
- Os cron jobs devem funcionar

---

## ✅ Solução 2: Usar pg_net (Se HTTP Não Funcionar)

Se a extensão `http` não estiver disponível, tente usar `pg_net`:

1. Execute primeiro:
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

2. Use o arquivo: `CRON-JOBS-CORRIGIDO.sql` (já configurado para pg_net)

---

## ✅ Solução 3: Supabase Scheduled Functions (Recomendado)

A forma mais simples e confiável no Supabase Cloud é usar **Scheduled Functions** via Dashboard:

### Como Configurar:

1. **Acesse o Dashboard:**
   - URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/database/cron

2. **Para cada Edge Function, criar um Scheduled Function:**

   **Exemplo 1: Sync Daily Metrics**
   - Function: `sync-daily-metrics`
   - Schedule: `0 0 * * *` (meia-noite)
   - URL: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/sync-daily-metrics`
   - Method: POST
   - Headers: `Authorization: Bearer [SERVICE_ROLE_KEY]`

   **Exemplo 2: Process WhatsApp Workflows**
   - Function: `process-whatsapp-workflows`
   - Schedule: `*/5 * * * *` (a cada 5 minutos)
   - URL: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-whatsapp-workflows`
   - Method: POST
   - Headers: `Authorization: Bearer [SERVICE_ROLE_KEY]`

   **E assim por diante para os 7 cron jobs...**

---

## ✅ Solução 4: Edge Function Intermediária

Criar uma Edge Function que faz as chamadas HTTP internamente:

1. **Criar Edge Function:** `cron-trigger`
2. **Cron jobs chamam essa função** (sem precisar de extensão HTTP)
3. **A função faz as chamadas HTTP** para outras Edge Functions

---

## 📋 Cron Jobs Necessários

1. `sync-daily-metrics` - `0 0 * * *` (meia-noite)
2. `process-whatsapp-workflows` - `*/5 * * * *` (a cada 5 min)
3. `process-broadcast-queue` - `*/1 * * * *` (a cada minuto)
4. `process-scheduled-messages` - `*/1 * * * *` (a cada minuto)
5. `process-status-schedule` - `*/5 * * * *` (a cada 5 min)
6. `sync-google-calendar-events` - `*/15 * * * *` (a cada 15 min)
7. `process-google-business-posts` - `*/30 * * * *` (a cada 30 min)

---

## 🎯 Recomendação

**Use a Solução 3 (Scheduled Functions via Dashboard)** - É a mais simples, confiável e não depende de extensões do PostgreSQL.

---

**Última atualização**: 15/12/2025 01:35




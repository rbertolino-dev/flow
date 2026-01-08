# 🔍 Análise: Campanhas Ficam Agendadas Mas Não Enviam

## 📋 Problema Identificado

**Sintoma:** Campanhas ficam agendadas (status `scheduled` na tabela `broadcast_queue`) mas não são enviadas.

## 🔎 Análise do Fluxo Atual

### 1. **Agendamento de Campanhas** (`BroadcastCampaigns.tsx`)

**Localização:** `src/pages/BroadcastCampaigns.tsx` - função `scheduleCampaignMessages` (linha 1625)

**O que faz:**
- Atualiza itens da `broadcast_queue` com:
  - `status: "scheduled"`
  - `scheduled_for: <timestamp calculado>`
- Atualiza campanha com `status: "running"`

**✅ Código parece correto** - atualiza status para "scheduled" e define `scheduled_for`

### 2. **Processamento da Fila** (`process-broadcast-queue`)

**Localização:** `supabase/functions/process-broadcast-queue/index.ts`

**O que faz:**
- Busca itens com:
  ```typescript
  .eq("status", "scheduled")
  .lte("scheduled_for", now)
  .limit(10)
  ```
- Processa e envia mensagens
- Atualiza status para "sent" ou "failed"

**✅ Código parece correto** - busca itens agendados corretamente

### 3. **Cron Job** (Configuração)

**Localização:** Scripts SQL em `scripts/configurar-cron-jobs*.sql`

**O que deveria fazer:**
- Chamar `process-broadcast-queue` a cada minuto via cron job do Supabase

## 🚨 POSSÍVEIS CAUSAS DO PROBLEMA

### ❌ **CAUSA 1: Cron Job Não Está Configurado ou Não Está Rodando**

**Verificação necessária:**
```sql
-- Verificar se cron job existe
SELECT * FROM cron.job WHERE jobname = 'process-broadcast-queue';

-- Verificar últimos runs
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-broadcast-queue')
ORDER BY start_time DESC 
LIMIT 10;
```

**Solução:**
- Executar script de configuração de cron jobs
- Verificar se `pg_cron` está habilitado
- Verificar se `net.http` está habilitado (necessário para chamar Edge Functions)

### ❌ **CAUSA 2: Edge Function Não Está Sendo Chamada**

**Verificação necessária:**
- Verificar logs da edge function no Supabase Dashboard
- Verificar se há erros de autenticação (verify_jwt)
- Verificar se SERVICE_ROLE_KEY está correta no cron job

**Configuração atual:**
- `verify_jwt = false` ✅ (correto para cron jobs)

### ❌ **CAUSA 3: Itens Não Estão Sendo Encontrados pela Query**

**Possíveis problemas:**
- `scheduled_for` está no futuro (ainda não chegou o horário)
- Status não está como "scheduled" (pode estar como "pending")
- Filtro de campanha cancelada está bloqueando itens válidos

**Verificação:**
```sql
-- Verificar itens agendados que deveriam ser processados
SELECT 
  bq.id,
  bq.status,
  bq.scheduled_for,
  bq.campaign_id,
  bc.status as campaign_status,
  NOW() as current_time,
  (bq.scheduled_for <= NOW()) as should_process
FROM broadcast_queue bq
JOIN broadcast_campaigns bc ON bc.id = bq.campaign_id
WHERE bq.status = 'scheduled'
  AND bq.scheduled_for <= NOW()
  AND bc.status = 'running'
LIMIT 20;
```

### ❌ **CAUSA 4: RLS (Row Level Security) Bloqueando Acesso**

**Possível problema:**
- Edge function usa SERVICE_ROLE_KEY (bypass RLS) ✅
- Mas pode haver problema nas políticas RLS que impedem leitura

**Verificação:**
```sql
-- Verificar políticas RLS da broadcast_queue
SELECT * FROM pg_policies WHERE tablename = 'broadcast_queue';
```

### ❌ **CAUSA 5: Limite de 10 Itens por Execução**

**Código atual:**
```typescript
.limit(10); // Processar 10 por vez
```

**Possível problema:**
- Se houver muitos itens agendados, pode demorar para processar todos
- Mas isso não deveria impedir completamente o envio

## 🔧 VERIFICAÇÕES RECOMENDADAS

### 1. Verificar Cron Job

```sql
-- Verificar se cron job existe e está ativo
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job 
WHERE jobname = 'process-broadcast-queue';
```

### 2. Verificar Últimas Execuções

```sql
-- Verificar últimos runs do cron job
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-broadcast-queue')
ORDER BY start_time DESC 
LIMIT 10;
```

### 3. Verificar Itens Agendados

```sql
-- Verificar itens que deveriam ser processados AGORA
SELECT 
  COUNT(*) as total_agendados,
  COUNT(*) FILTER (WHERE scheduled_for <= NOW()) as prontos_para_envio,
  MIN(scheduled_for) as primeiro_agendamento,
  MAX(scheduled_for) as ultimo_agendamento
FROM broadcast_queue
WHERE status = 'scheduled';
```

### 4. Verificar Status das Campanhas

```sql
-- Verificar campanhas running com itens agendados
SELECT 
  bc.id,
  bc.name,
  bc.status,
  COUNT(bq.id) FILTER (WHERE bq.status = 'scheduled') as agendados,
  COUNT(bq.id) FILTER (WHERE bq.status = 'scheduled' AND bq.scheduled_for <= NOW()) as prontos,
  COUNT(bq.id) FILTER (WHERE bq.status = 'sent') as enviados,
  COUNT(bq.id) FILTER (WHERE bq.status = 'failed') as falhas
FROM broadcast_campaigns bc
LEFT JOIN broadcast_queue bq ON bq.campaign_id = bc.id
WHERE bc.status = 'running'
GROUP BY bc.id, bc.name, bc.status;
```

### 5. Testar Edge Function Manualmente

```bash
# Chamar edge function manualmente para testar
curl -X POST \
  'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-broadcast-queue' \
  -H 'Authorization: Bearer <SERVICE_ROLE_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

## 📊 COMPARAÇÃO COM REPOSITÓRIO DE REFERÊNCIA

**Repositório de referência:** https://github.com/rbertolino-dev/kanban-buzz-95241.git

**Diferenças a verificar:**
1. Configuração do cron job (schedule, URL, headers)
2. Lógica de agendamento em `scheduleCampaignMessages`
3. Query de busca na edge function `process-broadcast-queue`
4. Tratamento de erros e logs

## 🎯 PRÓXIMOS PASSOS

1. ✅ **Verificar se cron job está configurado** (executar queries acima)
2. ✅ **Verificar logs da edge function** no Supabase Dashboard
3. ✅ **Testar edge function manualmente** para ver se funciona
4. ✅ **Verificar itens agendados** no banco de dados
5. ✅ **Comparar código com repositório de referência** (se acesso disponível)

## 🔍 CÓDIGO RELEVANTE

### Agendamento (BroadcastCampaigns.tsx)
```typescript
// Linha 1730-1736: Atualiza status para "scheduled"
await supabase
  .from("broadcast_queue")
  .update({
    status: "scheduled",
    scheduled_for: update.scheduled_for,
  })
  .eq("id", update.id)
```

### Processamento (process-broadcast-queue/index.ts)
```typescript
// Linha 24-38: Busca itens agendados
const { data: queueItems, error: fetchError } = await supabase
  .from("broadcast_queue")
  .select(`...`)
  .eq("status", "scheduled")
  .lte("scheduled_for", now)
  .limit(10);
```

### Cron Job (scripts/configurar-cron-jobs.sql)
```sql
-- Linha 58-71: Configuração do cron job
SELECT cron.schedule(
  'process-broadcast-queue',
  '*/1 * * * *', -- A cada minuto
  $$
  SELECT net.http_post(
    url := '[PROJECT_URL]/functions/v1/process-broadcast-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## ⚠️ OBSERVAÇÕES IMPORTANTES

1. **Cron Job precisa estar configurado** - sem ele, nada será processado
2. **SERVICE_ROLE_KEY precisa estar correta** - senão edge function não será chamada
3. **pg_cron e net.http precisam estar habilitados** - extensões necessárias
4. **Itens precisam ter `scheduled_for <= NOW()`** - senão não serão processados
5. **Campanha precisa estar com status "running"** - senão itens serão bloqueados

---

**Data da análise:** 2025-01-06
**Status:** Aguardando verificação de cron job e logs


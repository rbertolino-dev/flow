# 🔍 Resumo: Problema com Campanhas Agendadas

## 📋 Problema Reportado

**Sintoma:** Campanhas ficam agendadas mas não enviam mensagens.

## 🔎 Análise do Código

### ✅ **Código de Agendamento (CORRETO)**

**Arquivo:** `src/pages/BroadcastCampaigns.tsx`
- Função `scheduleCampaignMessages` (linha 1625)
- Atualiza `broadcast_queue` com:
  - `status: "scheduled"` ✅
  - `scheduled_for: <timestamp>` ✅
- Atualiza campanha com `status: "running"` ✅

**Conclusão:** O código de agendamento está funcionando corretamente.

### ✅ **Código de Processamento (CORRETO)**

**Arquivo:** `supabase/functions/process-broadcast-queue/index.ts`
- Busca itens com:
  - `status = "scheduled"` ✅
  - `scheduled_for <= NOW()` ✅
- Processa e envia mensagens ✅
- Atualiza status para "sent" ou "failed" ✅

**Conclusão:** O código de processamento está correto.

### ⚠️ **POSSÍVEL PROBLEMA: Cron Job Não Está Configurado ou Não Está Rodando**

**Este é o problema mais provável!**

A edge function `process-broadcast-queue` precisa ser chamada periodicamente (a cada minuto) por um cron job do Supabase. Se o cron job não estiver configurado ou não estiver rodando, as mensagens agendadas nunca serão processadas.

## 🔧 Verificações Necessárias

### 1. **Verificar se Cron Job Existe**

Execute no Supabase SQL Editor:

```sql
SELECT * FROM cron.job WHERE jobname = 'process-broadcast-queue';
```

**Se não retornar nada:** Cron job não está configurado. Execute:
```sql
-- Ver scripts/configurar-cron-jobs.sql
```

### 2. **Verificar se Cron Job Está Ativo**

```sql
SELECT jobid, jobname, active, schedule 
FROM cron.job 
WHERE jobname = 'process-broadcast-queue';
```

**Se `active = false`:** Ative com:
```sql
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'process-broadcast-queue'),
  active => true
);
```

### 3. **Verificar Últimas Execuções**

```sql
SELECT 
  start_time,
  status,
  return_message
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'process-broadcast-queue'
ORDER BY start_time DESC
LIMIT 10;
```

**Se não houver execuções recentes:** Cron job não está rodando.

### 4. **Verificar Extensões Necessárias**

```sql
-- Verificar pg_cron
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Verificar http (necessária para chamar Edge Functions)
SELECT * FROM pg_extension WHERE extname = 'http';
```

**Se não existirem:** Execute:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;
```

### 5. **Verificar Itens Agendados**

```sql
-- Verificar itens que deveriam ser processados AGORA
SELECT 
  COUNT(*) as total_agendados,
  COUNT(*) FILTER (WHERE scheduled_for <= NOW()) as prontos_para_envio
FROM broadcast_queue
WHERE status = 'scheduled';
```

**Se houver itens prontos mas não estão sendo enviados:** Cron job não está funcionando.

## 🎯 Solução Rápida

### Passo 1: Executar Script de Diagnóstico

```bash
# No Supabase SQL Editor, execute:
# scripts/diagnosticar-campanhas-agendadas.sql
```

### Passo 2: Se Cron Job Não Estiver Configurado

Execute um dos scripts de configuração:

```sql
-- Opção 1: Script completo (substituir SERVICE_ROLE_KEY)
-- scripts/configurar-cron-jobs-completo.sql

-- Opção 2: Script final (já tem URL configurada)
-- CRON-JOBS-FINAL.sql
```

**IMPORTANTE:** Substituir `[SERVICE_ROLE_KEY]` pela chave real do Supabase.

### Passo 3: Verificar Configuração

```sql
-- Verificar se cron job foi criado
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job 
WHERE jobname = 'process-broadcast-queue';
```

**Deve mostrar:**
- `jobname: 'process-broadcast-queue'`
- `schedule: '*/1 * * * *'` (a cada minuto)
- `active: true`

### Passo 4: Testar Manualmente

Chame a edge function manualmente para verificar se funciona:

```bash
curl -X POST \
  'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-broadcast-queue' \
  -H 'Authorization: Bearer <SERVICE_ROLE_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Se funcionar:** Retorna JSON com `{ processed: X, failed: Y, blocked: Z }`

## 📊 Comparação com Repositório de Referência

**Repositório:** https://github.com/rbertolino-dev/kanban-buzz-95241.git

**Diferenças a verificar:**
1. ✅ Configuração do cron job (mesma estrutura)
2. ✅ Lógica de agendamento (mesma estrutura)
3. ✅ Query de busca (mesma estrutura)
4. ⚠️ **Pode diferir:** Se cron job está configurado no banco de dados

## 🚨 Problemas Mais Comuns

### 1. **Cron Job Não Configurado**
- **Sintoma:** Itens ficam agendados mas nunca são processados
- **Solução:** Executar script de configuração de cron jobs

### 2. **Cron Job Inativo**
- **Sintoma:** Cron job existe mas não executa
- **Solução:** Ativar com `cron.alter_job(jobid, active => true)`

### 3. **SERVICE_ROLE_KEY Incorreta**
- **Sintoma:** Cron job executa mas edge function retorna erro 401
- **Solução:** Atualizar SERVICE_ROLE_KEY no comando do cron job

### 4. **Extensões Não Habilitadas**
- **Sintoma:** Erro ao criar cron job
- **Solução:** Habilitar `pg_cron` e `http`

### 5. **Itens Agendados no Futuro**
- **Sintoma:** Itens agendados mas `scheduled_for` está no futuro
- **Solução:** Aguardar horário ou verificar lógica de agendamento

## 📝 Checklist de Verificação

- [ ] Cron job `process-broadcast-queue` existe
- [ ] Cron job está ativo (`active = true`)
- [ ] Cron job executou recentemente (última hora)
- [ ] Extensão `pg_cron` está habilitada
- [ ] Extensão `http` está habilitada
- [ ] SERVICE_ROLE_KEY está correta no cron job
- [ ] Edge function `process-broadcast-queue` existe e está deployada
- [ ] `verify_jwt = false` na configuração da edge function
- [ ] Há itens com `status = 'scheduled'` e `scheduled_for <= NOW()`
- [ ] Campanhas estão com `status = 'running'`

## 🔍 Arquivos de Referência

- **Análise completa:** `ANALISE-PROBLEMA-CAMPANHAS-AGENDADAS.md`
- **Script de diagnóstico:** `scripts/diagnosticar-campanhas-agendadas.sql`
- **Scripts de configuração:**
  - `scripts/configurar-cron-jobs.sql`
  - `scripts/configurar-cron-jobs-completo.sql`
  - `CRON-JOBS-FINAL.sql`
  - `CRON-JOBS-PRONTO.sql`

## ✅ Próximos Passos

1. **Executar script de diagnóstico** para identificar o problema exato
2. **Verificar logs do Supabase** para ver se há erros
3. **Configurar cron job** se não estiver configurado
4. **Testar edge function manualmente** para validar funcionamento
5. **Monitorar execuções** do cron job para garantir que está rodando

---

**Data:** 2025-01-06
**Status:** Aguardando verificação de cron job


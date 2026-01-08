# 🚨 PROBLEMA IDENTIFICADO: Cron Job Usando Chave Errada

## 📋 Análise da Imagem Fornecida

Baseado na imagem do Supabase SQL Editor, identifiquei o problema:

### ✅ **O que está correto:**
- ✅ Cron job existe (`jobid: 3`)
- ✅ Cron job está ativo (`active: true`)
- ✅ Schedule correto (`*/1 * * * *` - a cada minuto)

### ❌ **PROBLEMA CRÍTICO:**
- ❌ O comando está usando chave **PUBLISHABLE** (`sb_publishable_7vsOSU_x3S0WheInFDj6yA`)
- ❌ Chave publishable **NÃO tem permissão** para chamar edge functions que usam `SERVICE_ROLE_KEY`
- ❌ Edge function `process-broadcast-queue` usa `SERVICE_ROLE_KEY` internamente
- ❌ Resultado: Cron job executa mas edge function retorna erro 401 (não autorizado)

## 🔧 Solução

### Passo 1: Verificar Detalhes do Cron Job

Execute no Supabase SQL Editor:

```sql
-- Ver comando completo e últimas execuções
-- scripts/verificar-cron-job-detalhes.sql
```

Isso vai mostrar:
- Comando completo do cron job
- Últimas execuções e seus status
- Erros retornados (provavelmente 401)

### Passo 2: Corrigir Cron Job

Execute o script de correção:

```sql
-- scripts/corrigir-cron-job-chave.sql
```

**IMPORTANTE:** Antes de executar, substitua `[SERVICE_ROLE_KEY]` pela chave real do Supabase.

**Onde encontrar a SERVICE_ROLE_KEY:**
1. Acesse Supabase Dashboard
2. Vá em **Settings > API**
3. Copie a chave **service_role** (secret) - NÃO a anon key!

### Passo 3: Verificar Correção

Após corrigir, execute:

```sql
SELECT 
  jobid,
  jobname,
  active,
  CASE 
    WHEN command LIKE '%sb_publishable%' THEN '❌ Ainda usando chave PUBLISHABLE'
    WHEN command LIKE '%Bearer [SERVICE_ROLE_KEY]%' THEN '⚠️ Placeholder não substituído'
    WHEN command LIKE '%Bearer eyJ%' THEN '✅ Usando chave JWT (correto)'
    ELSE '⚠️ Verificar manualmente'
  END as status_chave
FROM cron.job 
WHERE jobname = 'process-broadcast-queue';
```

Deve mostrar: `✅ Usando chave JWT (correto)`

### Passo 4: Testar Manualmente

Teste a edge function manualmente para validar:

```bash
curl -X POST \
  'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-broadcast-queue' \
  -H 'Authorization: Bearer <SERVICE_ROLE_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Se funcionar:** Retorna JSON com `{ processed: X, failed: Y, blocked: Z }`

**Se não funcionar:** Verificar se SERVICE_ROLE_KEY está correta

## 📊 Por Que Isso Aconteceu?

Provavelmente o cron job foi criado usando um script que tinha placeholder `[SERVICE_ROLE_KEY]` e foi substituído pela chave errada (publishable ao invés de service_role).

## ✅ Após Corrigir

Após corrigir a chave:
1. ✅ Cron job vai executar corretamente
2. ✅ Edge function vai processar itens agendados
3. ✅ Mensagens vão ser enviadas
4. ✅ Status vai mudar de "scheduled" para "sent"

## 🔍 Verificação Final

Após corrigir, aguarde 1-2 minutos e verifique:

```sql
-- Verificar se itens estão sendo processados
SELECT 
  COUNT(*) FILTER (WHERE status = 'scheduled' AND scheduled_for <= NOW()) as prontos,
  COUNT(*) FILTER (WHERE status = 'sent') as enviados,
  COUNT(*) FILTER (WHERE status = 'failed') as falhas
FROM broadcast_queue;
```

**Se "enviados" aumentar:** ✅ Problema resolvido!

---

**Data:** 2025-01-06
**Status:** Problema identificado - aguardando correção da chave


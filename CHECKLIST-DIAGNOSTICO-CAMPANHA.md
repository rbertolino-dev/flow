# 🔍 Checklist de Diagnóstico - Campanha Agendada Não Dispara

## ⚠️ Problema Reportado
- Campanha foi agendada mas não apareceu nada no log
- Campanha não disparou no horário agendado

---

## 📋 Checklist Completo

### ✅ 1. Verificar no Supabase SQL Editor

**Execute o script:** `DIAGNOSTICO-CAMPANHA-AGENDADA.sql`

**O que verificar:**
- [ ] **Coluna scheduled_start_at existe?** (Deve retornar "✅ Existe")
- [ ] **Cron job existe e está ativo?** (Deve retornar "✅ Existe e está ATIVO")
- [ ] **Extensões habilitadas?** (Deve retornar "✅ pg_cron e http habilitadas")
- [ ] **Campanhas agendadas?** (Deve mostrar quantas estão agendadas)
- [ ] **Campanhas que deveriam ter iniciado?** (Se retornar linhas, há problema!)
- [ ] **Últimas execuções do cron?** (Deve mostrar execuções recentes a cada minuto)
- [ ] **Itens na fila?** (Deve mostrar se há mensagens pendentes)

---

### ✅ 2. Verificar se Frontend Salvou scheduled_start_at

**Execute no Supabase SQL Editor:**
```sql
SELECT 
  id,
  name,
  status,
  scheduled_start_at,
  created_at,
  CASE 
    WHEN scheduled_start_at IS NULL THEN '❌ NÃO SALVOU - Frontend não fez deploy'
    WHEN scheduled_start_at > NOW() THEN '✅ Agendada para futuro'
    WHEN scheduled_start_at <= NOW() AND status = 'draft' THEN '⚠️ DEVERIA TER INICIADO'
    WHEN status = 'running' THEN '✅ Já iniciou'
    ELSE '❓ Status desconhecido'
  END as diagnostico
FROM broadcast_campaigns
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;
```

**O que verificar:**
- [ ] Se `scheduled_start_at` for NULL → Frontend não salvou (precisa fazer deploy)
- [ ] Se `scheduled_start_at` existe mas status ainda é 'draft' e horário passou → Cron job não está funcionando

---

### ✅ 3. Verificar Logs da Edge Function

**Acesse:**
https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions/process-scheduled-campaigns

**Vá na aba "Logs"**

**O que verificar:**
- [ ] Há logs aparecendo a cada minuto? (Deve aparecer: `📅 [process-scheduled-campaigns] Iniciando verificação...`)
- [ ] Se NÃO há logs → Cron job não está chamando a função
- [ ] Se há logs mas não processa campanhas → Verificar se há campanhas agendadas no banco

---

### ✅ 4. Verificar Cron Job Manualmente

**Execute no Supabase SQL Editor:**
```sql
-- Verificar se cron job está ativo
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN active = false THEN '❌ INATIVO - Precisa ativar!'
    WHEN schedule != '*/1 * * * *' THEN '⚠️ Schedule incorreto'
    ELSE '✅ Configurado corretamente'
  END as status
FROM cron.job 
WHERE jobname = 'process-scheduled-campaigns';

-- Verificar últimas execuções
SELECT 
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details 
WHERE jobid IN (
  SELECT jobid FROM cron.job WHERE jobname = 'process-scheduled-campaigns'
)
ORDER BY start_time DESC 
LIMIT 10;
```

**O que verificar:**
- [ ] `active` deve ser `true`
- [ ] `schedule` deve ser `*/1 * * * *` (a cada minuto)
- [ ] Deve haver execuções recentes (últimos 5-10 minutos)
- [ ] `status` das execuções deve ser `succeeded`

---

### ✅ 5. Testar Edge Function Manualmente

**Execute no Supabase SQL Editor:**
```sql
-- Chamar função manualmente para testar
SELECT net.http_post(
  url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-scheduled-campaigns',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm'
  ),
  body := '{}'::jsonb
) as resultado;
```

**Depois verifique:**
- [ ] Logs da função (deve aparecer nova execução)
- [ ] Se campanha estava agendada, deve iniciar após esta chamada

---

### ✅ 6. Verificar se Campanha Tem Itens na Fila

**Execute no Supabase SQL Editor:**
```sql
-- Verificar se campanha tem itens na fila
SELECT 
  bc.id as campaign_id,
  bc.name as campaign_name,
  bc.status as campaign_status,
  bc.scheduled_start_at,
  COUNT(bq.id) as total_itens_fila,
  COUNT(CASE WHEN bq.status = 'pending' THEN 1 END) as itens_pendentes
FROM broadcast_campaigns bc
LEFT JOIN broadcast_queue bq ON bq.campaign_id = bc.id
WHERE bc.scheduled_start_at IS NOT NULL
  AND bc.status = 'draft'
GROUP BY bc.id, bc.name, bc.status, bc.scheduled_start_at
ORDER BY bc.scheduled_start_at DESC
LIMIT 5;
```

**O que verificar:**
- [ ] Se `total_itens_fila` = 0 → Campanha não tem mensagens na fila (não vai disparar)
- [ ] Se `itens_pendentes` > 0 → Há mensagens prontas para enviar

---

## 🔧 Correções Comuns

### ❌ Problema 1: Frontend não salvou scheduled_start_at

**Sintoma:** `scheduled_start_at` é NULL no banco

**Solução:**
1. Fazer deploy do frontend:
   ```bash
   cd /root/kanban-buzz-95241
   ./scripts/deploy-zero-downtime.sh
   ```
2. Criar nova campanha após deploy

---

### ❌ Problema 2: Cron job não está ativo

**Sintoma:** Verificação 2 retorna "⚠️ Existe mas está INATIVO"

**Solução:**
```sql
-- Ativar cron job
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'process-scheduled-campaigns'),
  active => true
);
```

---

### ❌ Problema 3: Cron job não existe

**Sintoma:** Verificação 2 retorna "❌ NÃO EXISTE"

**Solução:**
Execute `DEPLOY-CAMPANHAS-AGENDADAS-FINAL.sql` no SQL Editor

---

### ❌ Problema 4: Extensões não habilitadas

**Sintoma:** Verificação 3 retorna "❌ Extensões faltando"

**Solução:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;
```

---

### ❌ Problema 5: Campanha não tem itens na fila

**Sintoma:** `total_itens_fila` = 0

**Solução:**
- A campanha precisa ter contatos adicionados
- Verificar se ao criar a campanha, os contatos foram adicionados à fila

---

### ❌ Problema 6: Edge function não está deployada

**Sintoma:** Logs não aparecem, função retorna 404

**Solução:**
- Fazer deploy da edge function `process-scheduled-campaigns`
- Veja: `GUIA-DEPLOY-PROCESS-SCHEDULED-CAMPAIGNS.md`

---

## 🧪 Teste Completo Passo a Passo

### Passo 1: Executar Diagnóstico
```sql
-- Execute DIAGNOSTICO-CAMPANHA-AGENDADA.sql
```

### Passo 2: Verificar Resultados
- Anotar quais verificações falharam
- Seguir correções acima

### Passo 3: Criar Campanha de Teste
1. Acesse "Disparador em Massa"
2. Crie campanha com 1-2 contatos
3. Agende para 2-3 minutos no futuro
4. Salve

### Passo 4: Verificar no Banco
```sql
SELECT id, name, status, scheduled_start_at
FROM broadcast_campaigns
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 1;
```

### Passo 5: Aguardar e Verificar
- Aguarde 2-3 minutos
- Verifique se status mudou para 'running'
- Verifique logs da função

---

## 📄 Scripts de Ajuda

1. **DIAGNOSTICO-CAMPANHA-AGENDADA.sql** - Diagnóstico completo automático
2. **VERIFICAR-CRON-JOB-CAMPANHAS-AGENDADAS.sql** - Verificação básica
3. **DEPLOY-CAMPANHAS-AGENDADAS-FINAL.sql** - Deploy completo (se necessário)

---

## ✅ Checklist Rápido

- [ ] Executeu `DIAGNOSTICO-CAMPANHA-AGENDADA.sql`
- [ ] Todas as verificações retornaram ✅
- [ ] Frontend salvou `scheduled_start_at` (não é NULL)
- [ ] Cron job está ativo (`active = true`)
- [ ] Há execuções recentes do cron job
- [ ] Logs da função aparecem a cada minuto
- [ ] Campanha tem itens na fila (`total_itens_fila > 0`)

**Se todos os itens estiverem ✅, a campanha deve disparar automaticamente!**

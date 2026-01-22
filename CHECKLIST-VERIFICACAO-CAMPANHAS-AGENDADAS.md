# ✅ Checklist de Verificação - Campanhas Agendadas

## 📋 Verificações Necessárias

### 1. ✅ Edge Function Deployada

**Verificar:**
- [ ] Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions
- [ ] Procure por `process-scheduled-campaigns`
- [ ] Deve aparecer na lista com status "Active"

**Teste HTTP:**
```bash
curl -X POST "https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-scheduled-campaigns" \
  -H "Authorization: Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Resultado esperado:** Status 200 com JSON `{"processed": 0, "message": "Nenhuma campanha agendada para iniciar"}`

---

### 2. ✅ Migration Aplicada

**Verificar no Supabase SQL Editor:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'broadcast_campaigns'
  AND column_name = 'scheduled_start_at';
```

**Resultado esperado:** Deve retornar 1 linha com `scheduled_start_at` (tipo: timestamp with time zone)

---

### 3. ✅ Cron Job Configurado

**Verificar no Supabase SQL Editor:**
```sql
SELECT jobid, jobname, schedule, active
FROM cron.job 
WHERE jobname = 'process-scheduled-campaigns';
```

**Resultado esperado:**
- Deve retornar 1 linha
- `schedule` = `*/1 * * * *` (a cada minuto)
- `active` = `true`

**Se não existir, execute:**
- `DEPLOY-CAMPANHAS-AGENDADAS-FINAL.sql` no SQL Editor

---

### 4. ✅ Frontend Salvando scheduled_start_at

**Verificar:**
- [ ] Código em `src/pages/BroadcastCampaigns.tsx` salva `scheduled_start_at`
- [ ] Linha deve ter: `scheduled_start_at: newCampaign.scheduledStart?.toISOString() || null`

**Status:** ✅ Já verificado - está correto

---

### 5. ✅ Logs da Função

**Verificar:**
- [ ] Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions/process-scheduled-campaigns
- [ ] Vá na aba "Logs"
- [ ] Deve aparecer logs a cada minuto: `📅 [process-scheduled-campaigns] Iniciando verificação...`

---

## 🧪 Teste Completo

### Criar Campanha de Teste:

1. Acesse "Disparador em Massa"
2. Crie uma nova campanha
3. Marque "Agendar início" e defina horário para **2-3 minutos no futuro**
4. Salve a campanha

### Verificar no Banco:

```sql
SELECT id, name, status, scheduled_start_at, created_at
FROM broadcast_campaigns
WHERE scheduled_start_at IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;
```

**Resultado esperado:**
- `status` = `'draft'`
- `scheduled_start_at` = horário agendado (futuro)

### Aguardar Execução:

Aguarde até o horário agendado passar (2-3 minutos).

### Verificar Início Automático:

```sql
SELECT id, name, status, scheduled_start_at, started_at
FROM broadcast_campaigns
WHERE id = 'ID_DA_CAMPANHA_DE_TESTE';
```

**Resultado esperado após horário agendado:**
- `status` mudou de `'draft'` para `'running'`
- `started_at` foi preenchido
- `scheduled_start_at` foi limpo (NULL)

---

## ✅ Tudo Certo?

Se todas as verificações passarem:
- ✅ Função está deployada
- ✅ Migration aplicada
- ✅ Cron job configurado
- ✅ Frontend salvando corretamente
- ✅ Logs aparecendo

**Então está tudo funcionando!** 🎉

---

**Script SQL de verificação:** `VERIFICAR-CRON-JOB-CAMPANHAS-AGENDADAS.sql`

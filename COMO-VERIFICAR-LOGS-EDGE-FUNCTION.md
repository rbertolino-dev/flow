# 🔍 Como Verificar Logs da Edge Function

## 📋 Edge Function Criada

**Nome:** `process-scheduled-campaigns`

**Localização:** `supabase/functions/process-scheduled-campaigns/index.ts`

**O que faz:**
- Verifica campanhas com status `'draft'` que têm `scheduled_start_at <= NOW()`
- Inicia automaticamente essas campanhas
- Agenda as mensagens da fila
- Atualiza status da campanha para `'running'`

---

## 🔍 Como Verificar Logs e Erros

### **Método 1: Via Supabase Dashboard (Recomendado)**

1. **Acesse o Dashboard:**
   - URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions

2. **Encontre a função:**
   - Procure por `process-scheduled-campaigns`
   - Clique na função

3. **Ver logs:**
   - Aba **"Logs"** ou **"Invocation Logs"**
   - Veja execuções recentes
   - Clique em uma execução para ver detalhes

4. **Ver erros:**
   - Logs em vermelho indicam erros
   - Mensagens de erro aparecem no console.log

---

### **Método 2: Via Supabase CLI**

```bash
cd /root/kanban-buzz-95241
supabase functions logs process-scheduled-campaigns --project-ref ogeljmbhqxpfjbpnbwog
```

---

### **Método 3: Testar Manualmente**

**Via Dashboard:**
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions/process-scheduled-campaigns
2. Clique em **"Invoke"** ou **"Test"**
3. Veja a resposta e logs

**Via cURL:**
```bash
curl -X POST \
  'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-scheduled-campaigns' \
  -H 'Authorization: Bearer [SERVICE_ROLE_KEY]' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

---

## 🐛 Erros Comuns e Como Identificar

### **Erro 1: "Column scheduled_start_at does not exist"**
**Causa:** Migration não foi aplicada  
**Solução:** Execute o SQL de migration primeiro

### **Erro 2: "No campaigns found"**
**Causa:** Não há campanhas agendadas no momento  
**Status:** ✅ Normal (não é erro)

### **Erro 3: "SUPABASE_SERVICE_ROLE_KEY is not set"**
**Causa:** Variável de ambiente não configurada  
**Solução:** Configure no Dashboard → Settings → Edge Functions → Secrets

### **Erro 4: "Failed to fetch queue items"**
**Causa:** Problema ao buscar itens da fila  
**Verificar:** Logs mostrarão o erro específico do Supabase

---

## 📊 Verificar se Edge Function Está Funcionando

### **Query SQL para Verificar Execuções do Cron Job:**

```sql
-- Ver últimas execuções do cron job
SELECT 
  runid,
  start_time,
  status,
  return_message,
  CASE 
    WHEN status = 'succeeded' THEN '✅ Sucesso'
    WHEN status = 'failed' THEN '❌ Falhou'
    ELSE '⚠️ ' || status
  END as resultado
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'process-scheduled-campaigns'
ORDER BY start_time DESC
LIMIT 10;
```

### **Verificar Campanhas Agendadas:**

```sql
-- Ver campanhas que estão agendadas
SELECT 
  id,
  name,
  status,
  scheduled_start_at,
  CASE 
    WHEN scheduled_start_at <= NOW() THEN '⏰ Deveria iniciar agora'
    ELSE '⏳ Aguardando horário'
  END as status_agendamento
FROM broadcast_campaigns 
WHERE scheduled_start_at IS NOT NULL 
  AND status = 'draft'
ORDER BY scheduled_start_at;
```

---

## 🔧 Debug da Edge Function

### **Logs Importantes na Edge Function:**

A edge function já tem logs detalhados:

```typescript
console.log("📅 [process-scheduled-campaigns] Iniciando verificação...");
console.log(`📋 Encontradas ${scheduledCampaigns?.length || 0} campanha(s)...`);
console.log(`🚀 Iniciando campanha agendada: ${campaign.name}`);
console.log(`✅ Campanha ${campaign.name} iniciada com sucesso`);
console.error("❌ Erro ao processar campanha:", error);
```

**Onde ver:**
- Dashboard → Functions → process-scheduled-campaigns → Logs
- Procure por essas mensagens para entender o que está acontecendo

---

## ✅ Checklist de Verificação

- [ ] Edge function foi deployada?
- [ ] SERVICE_ROLE_KEY está configurada nas secrets?
- [ ] Cron job está ativo?
- [ ] Migration foi aplicada (coluna existe)?
- [ ] Há campanhas agendadas para testar?
- [ ] Logs mostram execuções?

---

**Edge Function:** `process-scheduled-campaigns`  
**URL:** `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-scheduled-campaigns`  
**Logs:** Dashboard → Functions → process-scheduled-campaigns → Logs

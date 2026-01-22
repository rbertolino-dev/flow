# 🚀 Instruções de Deploy: Campanhas Agendadas

## ✅ O que foi implementado

1. ✅ **Migration criada**: `supabase/migrations/20260121000001_add_scheduled_start_at_to_broadcast_campaigns.sql`
2. ✅ **Código atualizado**: `src/pages/BroadcastCampaigns.tsx` agora salva `scheduledStart`
3. ✅ **Edge function criada**: `supabase/functions/process-scheduled-campaigns/index.ts`
4. ✅ **Configuração atualizada**: `supabase/config.toml` com nova edge function
5. ✅ **Cron job configurado**: Adicionado ao `CRON-JOBS-FINAL.sql`

---

## 📋 Passo a Passo para Deploy

### **PASSO 1: Aplicar Migration e Configurar Cron Job**

1. Acesse o **Supabase SQL Editor**:
   - URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

2. Execute o arquivo **`DEPLOY-CAMPANHAS-AGENDADAS.sql`**:
   - Copie TODO o conteúdo do arquivo
   - Cole no SQL Editor
   - Clique em **Run** ou pressione `Ctrl+Enter`
   - Aguarde confirmação de sucesso

   **O que este SQL faz:**
   - ✅ Adiciona coluna `scheduled_start_at` na tabela `broadcast_campaigns`
   - ✅ Cria índice para otimizar queries
   - ✅ Configura cron job `process-scheduled-campaigns` (executa a cada minuto)
   - ✅ Verifica se tudo foi criado corretamente

---

### **PASSO 2: Deploy da Edge Function**

Você tem **2 opções**:

#### **Opção A: Via Supabase Dashboard (Recomendado)**

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions
2. Procure pela função `process-scheduled-campaigns`
3. Se não existir, clique em **"Create a new function"**
4. Cole o conteúdo de `supabase/functions/process-scheduled-campaigns/index.ts`
5. Clique em **"Deploy"**

#### **Opção B: Via Supabase CLI**

```bash
cd /root/kanban-buzz-95241
export SUPABASE_ACCESS_TOKEN="seu-token-aqui"
supabase functions deploy process-scheduled-campaigns
```

---

### **PASSO 3: Verificar se Está Funcionando**

Execute no Supabase SQL Editor:

```sql
-- 1. Verificar se coluna foi criada
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'broadcast_campaigns'
  AND column_name = 'scheduled_start_at';

-- 2. Verificar se cron job foi criado e está ativo
SELECT jobid, jobname, schedule, active 
FROM cron.job 
WHERE jobname = 'process-scheduled-campaigns';

-- 3. Verificar últimas execuções do cron job
SELECT start_time, status, return_message
FROM cron.job_run_details jrd
JOIN cron.job j ON jrd.jobid = j.jobid
WHERE j.jobname = 'process-scheduled-campaigns'
ORDER BY start_time DESC
LIMIT 5;
```

---

## 🧪 Como Testar

1. **Criar uma campanha de teste**:
   - Acesse o módulo de Disparo em Massa
   - Crie uma nova campanha
   - **Agende o início** para alguns minutos no futuro (ex: 5 minutos)
   - Salve a campanha

2. **Verificar no banco**:
   ```sql
   SELECT id, name, status, scheduled_start_at 
   FROM broadcast_campaigns 
   WHERE scheduled_start_at IS NOT NULL 
     AND status = 'draft'
   ORDER BY scheduled_start_at;
   ```

3. **Aguardar o horário agendado**:
   - O cron job executa a cada minuto
   - Quando chegar o horário, a campanha será iniciada automaticamente
   - Verifique os logs da edge function no Dashboard

4. **Verificar se iniciou**:
   ```sql
   SELECT id, name, status, started_at, scheduled_start_at
   FROM broadcast_campaigns 
   WHERE scheduled_start_at IS NOT NULL
   ORDER BY started_at DESC
   LIMIT 5;
   ```

---

## 📊 Arquivos Criados/Modificados

### Novos Arquivos:
- ✅ `supabase/migrations/20260121000001_add_scheduled_start_at_to_broadcast_campaigns.sql`
- ✅ `supabase/migrations/20260121000002_add_process_scheduled_campaigns_cron.sql`
- ✅ `supabase/functions/process-scheduled-campaigns/index.ts`
- ✅ `DEPLOY-CAMPANHAS-AGENDADAS.sql` (SQL completo para deploy)
- ✅ `scripts/aplicar-migration-campanhas-agendadas.sh` (Script interativo)
- ✅ `INSTRUCOES-DEPLOY-CAMPANHAS-AGENDADAS.md` (Este arquivo)

### Arquivos Modificados:
- ✅ `src/pages/BroadcastCampaigns.tsx` (salva `scheduledStart`)
- ✅ `supabase/config.toml` (configuração da edge function)
- ✅ `CRON-JOBS-FINAL.sql` (adicionado cron job)

---

## ⚠️ Troubleshooting

### Problema: Cron job não está executando

**Solução:**
```sql
-- Verificar se está ativo
SELECT * FROM cron.job WHERE jobname = 'process-scheduled-campaigns';

-- Se active = false, ativar:
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'process-scheduled-campaigns'),
  active => true
);
```

### Problema: Edge function retorna erro

**Solução:**
1. Verificar logs no Dashboard: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions/process-scheduled-campaigns/logs
2. Verificar se SERVICE_ROLE_KEY está configurada
3. Testar manualmente chamando a função

### Problema: Campanhas não iniciam automaticamente

**Verificações:**
1. ✅ Coluna `scheduled_start_at` existe?
2. ✅ Cron job está ativo?
3. ✅ Edge function foi deployada?
4. ✅ `scheduled_start_at` está preenchido na campanha?
5. ✅ Status da campanha é `'draft'`?

---

## ✅ Checklist Final

- [ ] Migration aplicada (coluna `scheduled_start_at` criada)
- [ ] Cron job configurado e ativo
- [ ] Edge function deployada
- [ ] Teste realizado com campanha agendada
- [ ] Campanha iniciou automaticamente no horário agendado

---

**Pronto!** Após seguir estes passos, as campanhas agendadas iniciarão automaticamente no horário determinado. 🎉

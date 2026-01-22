# ✅ Verificação Completa - process-scheduled-campaigns

## 📊 Status das Verificações

### ✅ 1. Arquivo Local
- **Status:** ✅ Existe
- **Localização:** `supabase/functions/process-scheduled-campaigns/index.ts`
- **Linhas:** 208
- **Tamanho:** 7.9K

### ✅ 2. Configuração (config.toml)
- **Status:** ✅ Configurada
- **Config:**
  ```toml
  [functions.process-scheduled-campaigns]
  verify_jwt = false
  ```

### ✅ 3. Migration
- **Status:** ✅ Existe
- **Arquivo:** `supabase/migrations/20260121000001_add_scheduled_start_at_to_broadcast_campaigns.sql`
- **O que faz:** Adiciona coluna `scheduled_start_at` na tabela `broadcast_campaigns`

### ✅ 4. Frontend
- **Status:** ✅ Salva `scheduled_start_at`
- **Arquivo:** `src/pages/BroadcastCampaigns.tsx`
- **Linha:** Contém `scheduled_start_at: newCampaign.scheduledStart?.toISOString() || null`

### ⚠️ 5. Deploy (Precisa Verificar Manualmente)
- **Status:** ⚠️ Teste HTTP retornou 401 (pode ser normal)
- **Ação necessária:** Verificar no Dashboard do Supabase

---

## 🔍 Verificações Manuais Necessárias

### 1. Verificar se Função Está Deployada

**Acesse:**
https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions

**Procure por:** `process-scheduled-campaigns`

**Deve aparecer:**
- ✅ Na lista de funções
- ✅ Status "Active" ou "Deployed"
- ✅ Última atualização recente

---

### 2. Verificar Cron Job

**Execute no Supabase SQL Editor:**
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
- Arquivo: `DEPLOY-CAMPANHAS-AGENDADAS-FINAL.sql`
- No Supabase SQL Editor

---

### 3. Verificar Migration Aplicada

**Execute no Supabase SQL Editor:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'broadcast_campaigns'
  AND column_name = 'scheduled_start_at';
```

**Resultado esperado:**
- Deve retornar 1 linha
- `column_name` = `scheduled_start_at`
- `data_type` = `timestamp with time zone`

**Se não existir, execute:**
- Arquivo: `DEPLOY-CAMPANHAS-AGENDADAS-FINAL.sql`
- No Supabase SQL Editor

---

### 4. Verificar Logs da Função

**Acesse:**
https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions/process-scheduled-campaigns

**Vá na aba "Logs"**

**Deve aparecer:**
- Logs a cada minuto (se cron job estiver rodando)
- Mensagem: `📅 [process-scheduled-campaigns] Iniciando verificação de campanhas agendadas...`

---

## 🧪 Teste Completo (Opcional)

### Passo 1: Criar Campanha de Teste

1. Acesse "Disparador em Massa" no sistema
2. Crie uma nova campanha
3. Marque "Agendar início"
4. Defina horário para **2-3 minutos no futuro**
5. Salve a campanha

### Passo 2: Verificar no Banco

**Execute no Supabase SQL Editor:**
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

### Passo 3: Aguardar Execução

Aguarde até o horário agendado passar (2-3 minutos).

### Passo 4: Verificar Início Automático

**Execute no Supabase SQL Editor:**
```sql
SELECT id, name, status, scheduled_start_at, started_at
FROM broadcast_campaigns
WHERE scheduled_start_at IS NOT NULL
  OR (started_at > NOW() - INTERVAL '5 minutes' AND status = 'running')
ORDER BY created_at DESC
LIMIT 1;
```

**Resultado esperado após horário agendado:**
- `status` mudou de `'draft'` para `'running'`
- `started_at` foi preenchido
- `scheduled_start_at` foi limpo (NULL)

---

## ✅ Checklist Final

- [ ] Função está deployada no Dashboard
- [ ] Cron job configurado e ativo
- [ ] Migration aplicada (coluna existe)
- [ ] Logs aparecendo a cada minuto
- [ ] Teste completo funcionou (opcional)

**Se todos os itens estiverem ✅, está tudo funcionando!** 🎉

---

## 📄 Scripts de Verificação

1. **VERIFICAR-CRON-JOB-CAMPANHAS-AGENDADAS.sql** - Verificação completa via SQL
2. **CHECKLIST-VERIFICACAO-CAMPANHAS-AGENDADAS.md** - Checklist detalhado

---

## 🆘 Se Algo Não Estiver Funcionando

### Cron Job Não Existe:
- Execute `DEPLOY-CAMPANHAS-AGENDADAS-FINAL.sql` no SQL Editor

### Migration Não Aplicada:
- Execute `DEPLOY-CAMPANHAS-AGENDADAS-FINAL.sql` no SQL Editor

### Função Não Está Deployada:
- Faça deploy manual via Dashboard ou CLI
- Veja: `GUIA-DEPLOY-PROCESS-SCHEDULED-CAMPAIGNS.md`

### Logs Não Aparecem:
- Verifique se cron job está ativo
- Verifique se extensões `pg_cron` e `http` estão habilitadas

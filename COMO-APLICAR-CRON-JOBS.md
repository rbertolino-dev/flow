# ⏰ Como Aplicar os Cron Jobs

**Status**: ⏳ **SQL Pronto - Aguardando Execução**

---

## 📋 O Que Foi Feito

✅ **Arquivo SQL criado**: `CRON-JOBS-FINAL.sql`
- ✅ Todas as 7 cron jobs configuradas
- ✅ Service Role Key configurada (usando token fornecido)
- ✅ Project URL configurado

---

## ⚠️ Nota Importante

O token fornecido (`sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm`) parece ser um **publishable key**, não um **service_role key**.

**Para cron jobs funcionarem corretamente, você precisa do Service Role Key:**
- Formato: Geralmente começa com `eyJ...` (JWT)
- Onde obter: Dashboard → Settings → API → Role: `service_role` (secret)

**Se o token fornecido não funcionar, você precisará:**
1. Obter o Service Role Key correto do Dashboard
2. Substituir no arquivo `CRON-JOBS-FINAL.sql`
3. Executar novamente

---

## 🚀 Como Aplicar

### Opção 1: Via SQL Editor (Recomendado)

1. **Acesse o SQL Editor:**
   - URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

2. **Copie o conteúdo do arquivo:**
   ```bash
   cat CRON-JOBS-FINAL.sql
   ```

3. **Cole no SQL Editor e execute**

4. **Verificar se funcionou:**
   ```sql
   SELECT jobid, schedule, active FROM cron.job ORDER BY jobid;
   ```

---

### Opção 2: Via psql (Se Tiver Acesso Direto)

```bash
export PGPASSWORD=[SUA_SENHA]
psql -h db.ogeljmbhqxpfjbpnbwog.supabase.co -U postgres -d postgres -f CRON-JOBS-FINAL.sql
```

---

## 📋 Cron Jobs que Serão Criados

1. `sync-daily-metrics` - Meia-noite (diário)
2. `process-whatsapp-workflows` - A cada 5 minutos
3. `process-broadcast-queue` - A cada minuto
4. `process-scheduled-messages` - A cada minuto
5. `process-status-schedule` - A cada 5 minutos
6. `sync-google-calendar-events` - A cada 15 minutos
7. `process-google-business-posts` - A cada 30 minutos

---

## ✅ Verificar Após Aplicar

```sql
-- Ver todos os cron jobs
SELECT * FROM cron.job;

-- Ver histórico de execuções
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

---

## 🔧 Se Der Erro

### Erro: "extension pg_cron does not exist"
- Execute primeiro: `CREATE EXTENSION IF NOT EXISTS pg_cron;`

### Erro: "extension http does not exist"
- Execute primeiro: `CREATE EXTENSION IF NOT EXISTS http;`

### Erro: "unauthorized" ou "forbidden"
- Verificar se Service Role Key está correto
- Obter Service Role Key correto do Dashboard

---

**Última atualização**: 15/12/2025 01:25




# 🧪 O Que Fazer Para Testar a Campanha Agendada

## ✅ O Que Já Está Pronto (Supabase)

1. ✅ **Edge Function deployada:** `process-scheduled-campaigns`
2. ✅ **Cron job configurado:** Executa a cada minuto
3. ✅ **Migration aplicada:** Coluna `scheduled_start_at` existe
4. ✅ **Código frontend:** Já salva `scheduled_start_at` no banco

---

## 🚀 O Que Precisa Fazer Deploy

### ⚠️ **APENAS O FRONTEND** (Não precisa fazer deploy no Supabase!)

O Supabase já está tudo configurado. Você só precisa fazer deploy do **frontend** para que o código que salva `scheduled_start_at` esteja no servidor.

---

## 📋 Passo a Passo para Testar

### 1. Fazer Deploy do Frontend

**Execute:**
```bash
cd /root/kanban-buzz-95241
./scripts/deploy-zero-downtime.sh
```

Isso vai fazer deploy do frontend com o código que salva `scheduled_start_at`.

---

### 2. Criar Campanha de Teste

1. Acesse "Disparador em Massa" no sistema
2. Crie uma nova campanha
3. Marque "Agendar início"
4. Defina horário para **2-3 minutos no futuro**
5. Salve a campanha

---

### 3. Verificar no Banco (Opcional)

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

---

### 4. Aguardar Execução

Aguarde até o horário agendado passar (2-3 minutos).

---

### 5. Verificar Início Automático

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
- ✅ `status` mudou de `'draft'` para `'running'`
- ✅ `started_at` foi preenchido
- ✅ `scheduled_start_at` foi limpo (NULL)

---

## ✅ Resumo

**Para testar a campanha:**
- ✅ **Fazer deploy do frontend** (usar `deploy-zero-downtime.sh`)
- ❌ **NÃO precisa fazer deploy no Supabase** (já está tudo lá)

**Depois:**
- Criar campanha de teste com agendamento
- Aguardar 2-3 minutos
- Verificar se iniciou automaticamente

---

## 🆘 Se Não Funcionar

### Verificar Logs da Função:
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions/process-scheduled-campaigns
2. Vá na aba "Logs"
3. Deve aparecer logs a cada minuto: `📅 [process-scheduled-campaigns] Iniciando verificação...`

### Verificar Cron Job:
Execute `VERIFICAR-CRON-JOB-CAMPANHAS-AGENDADAS.sql` no SQL Editor

### Verificar se Frontend Salvou:
```sql
SELECT scheduled_start_at 
FROM broadcast_campaigns 
WHERE id = 'ID_DA_CAMPANHA';
```
Se `scheduled_start_at` for NULL, o frontend não salvou (precisa fazer deploy do frontend).

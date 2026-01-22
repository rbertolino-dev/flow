# 🚨 Guia Rápido - Campanha Não Disparou

## ⚡ Diagnóstico em 3 Passos

### 1️⃣ Execute o Script SQL

**No Supabase SQL Editor, execute:**
```
DIAGNOSTICO-CAMPANHA-AGENDADA.sql
```

**O script verifica automaticamente 8 coisas:**
1. ✅ Coluna `scheduled_start_at` existe?
2. ✅ Cron job existe e está ativo?
3. ✅ Extensões habilitadas?
4. ✅ Há campanhas agendadas?
5. ⚠️ **Campanhas que deveriam ter iniciado?** (PROBLEMA AQUI!)
6. ✅ Cron job está executando?
7. ✅ Há itens na fila?
8. ✅ Detalhes do cron job

---

### 2️⃣ Veja o Resultado da Verificação 5

**Se a verificação 5 retornar linhas:**
```
⚠️ PROBLEMA: Campanha está agendada mas não iniciou!
```

**Possíveis causas:**
- ❌ Cron job não está ativo
- ❌ Cron job não está executando
- ❌ Edge function não está deployada
- ❌ Campanha não tem itens na fila

---

### 3️⃣ Siga as Correções

**Se cron job não está ativo:**
```sql
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'process-scheduled-campaigns'),
  active => true
);
```

**Se cron job não existe:**
- Execute: `DEPLOY-CAMPANHAS-AGENDADAS-FINAL.sql`

**Se frontend não salvou scheduled_start_at:**
- Execute: `./scripts/deploy-zero-downtime.sh`

**Se não há itens na fila:**
- Verificar se campanha tem contatos adicionados

---

## 🔍 Verificações Manuais Rápidas

### Verificar se Frontend Salvou:
```sql
SELECT id, name, scheduled_start_at, status
FROM broadcast_campaigns
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 1;
```

**Se `scheduled_start_at` for NULL:**
- ❌ Frontend não salvou → Fazer deploy do frontend

**Se `scheduled_start_at` existe mas status ainda é 'draft':**
- ❌ Cron job não está funcionando → Verificar cron job

---

### Verificar Logs da Função:
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions/process-scheduled-campaigns
2. Vá em "Logs"
3. Deve aparecer logs a cada minuto

**Se não há logs:**
- ❌ Cron job não está chamando a função

---

### Testar Função Manualmente:
```sql
SELECT net.http_post(
  url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-scheduled-campaigns',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm'
  ),
  body := '{}'::jsonb
);
```

**Depois verifique:**
- Logs da função (deve aparecer nova execução)
- Se campanha estava agendada, deve iniciar

---

## ✅ Checklist Rápido

Execute `DIAGNOSTICO-CAMPANHA-AGENDADA.sql` e verifique:

- [ ] Verificação 1: ✅ Coluna existe
- [ ] Verificação 2: ✅ Cron job ativo
- [ ] Verificação 3: ✅ Extensões habilitadas
- [ ] Verificação 4: ✅ Há campanhas agendadas
- [ ] Verificação 5: ⚠️ **Nenhuma campanha que deveria ter iniciado** (se retornar linhas = problema!)
- [ ] Verificação 6: ✅ Há execuções recentes do cron
- [ ] Verificação 7: ✅ Há itens na fila
- [ ] Verificação 8: ✅ Cron job configurado corretamente

---

## 🆘 Problemas Mais Comuns

### 1. Frontend não salvou scheduled_start_at
**Solução:** Fazer deploy do frontend

### 2. Cron job não está ativo
**Solução:** Ativar com `cron.alter_job`

### 3. Cron job não existe
**Solução:** Executar `DEPLOY-CAMPANHAS-AGENDADAS-FINAL.sql`

### 4. Não há itens na fila
**Solução:** Verificar se campanha tem contatos

### 5. Edge function não está deployada
**Solução:** Fazer deploy da função

---

## 📄 Documentos Completos

- **DIAGNOSTICO-CAMPANHA-AGENDADA.sql** - Script SQL completo
- **CHECKLIST-DIAGNOSTICO-CAMPANHA.md** - Checklist detalhado com todas as correções

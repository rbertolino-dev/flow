# 🔧 Instruções: Corrigir Cron Job com Chave Real

## 🚨 Problema Identificado

O cron job foi criado, mas ainda tem o placeholder `[SERVICE_ROLE_KEY]` no comando, o que impede a autorização correta na edge function.

**Status atual:** ⚠️ Placeholder não substituído

## ✅ Solução Passo a Passo

### Passo 1: Obter a SERVICE_ROLE_KEY

1. Acesse o Supabase Dashboard:
   ```
   https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/settings/api
   ```

2. Na seção **API Keys**, encontre:
   - **Role:** `service_role`
   - **Key:** (chave secreta - copie esta!)

3. ⚠️ **IMPORTANTE:** Use a chave `service_role` (secret), **NÃO** a `anon` key!

### Passo 2: Abrir Script de Correção

Abra o arquivo: `scripts/atualizar-cron-job-com-chave-real.sql`

### Passo 3: Substituir Placeholder

No script, encontre a linha:
```sql
v_service_role_key TEXT := '[SERVICE_ROLE_KEY]'; -- ⚠️ SUBSTITUIR AQUI!
```

Substitua `[SERVICE_ROLE_KEY]` pela chave real que você copiou.

**Exemplo:**
```sql
v_service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; -- Chave real
```

### Passo 4: Executar Script

1. Cole o script completo no Supabase SQL Editor
2. Certifique-se de que substituiu `[SERVICE_ROLE_KEY]` pela chave real
3. Execute o script (Ctrl+Enter ou botão Run)

### Passo 5: Verificar Correção

Após executar, o script vai mostrar uma query de verificação. Deve aparecer:

```
status_chave: ✅ Usando chave JWT (correto)
```

Se ainda aparecer `❌ Placeholder ainda não substituído`, você esqueceu de substituir a chave no script.

## 🔍 Verificação Manual

Execute esta query para verificar:

```sql
SELECT 
  jobid,
  jobname,
  active,
  CASE 
    WHEN command LIKE '%[SERVICE_ROLE_KEY]%' THEN '❌ Placeholder ainda não substituído'
    WHEN command LIKE '%sb_publishable%' THEN '❌ Usando chave PUBLISHABLE (errado)'
    WHEN command LIKE '%Bearer eyJ%' THEN '✅ Usando chave JWT (correto)'
    ELSE '⚠️ Verificar manualmente'
  END as status_chave
FROM cron.job 
WHERE jobname = 'process-broadcast-queue';
```

**Resultado esperado:** `✅ Usando chave JWT (correto)`

## 🧪 Testar Manualmente

Após corrigir, teste a edge function manualmente:

```bash
curl -X POST \
  'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-broadcast-queue' \
  -H 'Authorization: Bearer <SERVICE_ROLE_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Se funcionar:** Retorna JSON com `{ processed: X, failed: Y, blocked: Z }`

## ⏱️ Aguardar Execução

Após corrigir:
1. Aguarde 1-2 minutos (cron job roda a cada minuto)
2. Verifique se itens estão sendo processados:

```sql
SELECT 
  COUNT(*) FILTER (WHERE status = 'scheduled' AND scheduled_for <= NOW()) as prontos,
  COUNT(*) FILTER (WHERE status = 'sent') as enviados,
  COUNT(*) FILTER (WHERE status = 'failed') as falhas
FROM broadcast_queue;
```

**Se "enviados" aumentar:** ✅ Problema resolvido!

## 🚨 Troubleshooting

### Erro: "Placeholder ainda não substituído"
- **Causa:** Você esqueceu de substituir `[SERVICE_ROLE_KEY]` no script
- **Solução:** Substitua pela chave real e execute novamente

### Erro: "Cron job não encontrado"
- **Causa:** Cron job foi removido
- **Solução:** Execute o script de criação primeiro: `scripts/corrigir-cron-job-chave.sql`

### Edge function retorna 401
- **Causa:** Chave SERVICE_ROLE_KEY está incorreta
- **Solução:** Verifique se copiou a chave correta (service_role, não anon)

### Cron job não executa
- **Causa:** Cron job pode estar inativo
- **Solução:** Ative com:
  ```sql
  SELECT cron.alter_job(
    (SELECT jobid FROM cron.job WHERE jobname = 'process-broadcast-queue'),
    active => true
  );
  ```

## 📝 Checklist

- [ ] Copiei a SERVICE_ROLE_KEY do Supabase Dashboard
- [ ] Substituí `[SERVICE_ROLE_KEY]` no script pela chave real
- [ ] Executei o script no Supabase SQL Editor
- [ ] Verifiquei que status mostra "✅ Usando chave JWT (correto)"
- [ ] Testei edge function manualmente (opcional)
- [ ] Aguardei 1-2 minutos e verifiquei se itens estão sendo processados

---

**Arquivo:** `scripts/atualizar-cron-job-com-chave-real.sql`
**Status:** Aguardando substituição da chave e execução


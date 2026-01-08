# ✅ Instruções Finais: Corrigir Cron Job (Versão Corrigida)

## 🚨 Problema Resolvido

O erro de sintaxe foi corrigido! O problema estava no método alternativo comentado.

## 📋 Solução Simples (3 Passos)

### Passo 1: Obter SERVICE_ROLE_KEY

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/settings/api
2. Na seção **API Keys**, encontre:
   - **Role:** `service_role`
   - **Key:** (chave secreta - copie esta!)
3. ⚠️ **IMPORTANTE:** Use a chave `service_role` (secret), **NÃO** a `anon` key!

### Passo 2: Abrir e Editar Script

Abra o arquivo: **`scripts/corrigir-cron-job-final.sql`**

Na linha 25, você verá:
```sql
'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
```

**Substitua `[SERVICE_ROLE_KEY]` pela chave real que você copiou.**

**Exemplo:**
```sql
'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nZWxqbWJocXhwZmpicG53b2ciLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzM2MTI5NjAwLCJleHAiOjE3Njc3NDU2MDB9...'
```

### Passo 3: Executar no Supabase SQL Editor

1. Cole o script completo no Supabase SQL Editor
2. Certifique-se de que substituiu `[SERVICE_ROLE_KEY]` pela chave real
3. Execute o script (Ctrl+Enter ou botão Run)

### Passo 4: Verificar

Após executar, o script vai mostrar uma query de verificação. Deve aparecer:

```
status_chave: ✅ Usando chave JWT (correto)
```

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

## 📝 Arquivos Disponíveis

1. **`scripts/corrigir-cron-job-final.sql`** - Script SQL simples e funcional (RECOMENDADO)
2. **`scripts/corrigir-cron-job-simples.sql`** - Versão alternativa
3. **`scripts/atualizar-cron-job-com-chave-real.sql`** - Versão com método DO (mais complexo)

## 🚨 Troubleshooting

### Erro: "Placeholder ainda não substituído"
- **Causa:** Você esqueceu de substituir `[SERVICE_ROLE_KEY]` no script
- **Solução:** Substitua pela chave real e execute novamente

### Erro: "Cron job não encontrado"
- **Causa:** Cron job foi removido
- **Solução:** O script já cria um novo, então não há problema

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

## ✅ Checklist

- [ ] Copiei a SERVICE_ROLE_KEY do Supabase Dashboard
- [ ] Substituí `[SERVICE_ROLE_KEY]` no script pela chave real
- [ ] Executei o script no Supabase SQL Editor
- [ ] Verifiquei que status mostra "✅ Usando chave JWT (correto)"
- [ ] Testei edge function manualmente (opcional)
- [ ] Aguardei 1-2 minutos e verifiquei se itens estão sendo processados

---

**Arquivo recomendado:** `scripts/corrigir-cron-job-final.sql`
**Status:** ✅ Erro de sintaxe corrigido - pronto para uso


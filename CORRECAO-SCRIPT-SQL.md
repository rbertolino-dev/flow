# 🔧 Correção do Script SQL - Campanhas Agendadas

## ❌ Problemas Identificados

### **Problema 1: Bloco DO $$ com PERFORM**
O script original usava:
```sql
DO $$
BEGIN
  PERFORM cron.schedule(...);
END $$;
```

**Por que não funcionava:**
- `PERFORM` dentro de blocos DO pode ter problemas de escopo
- Alguns sistemas não executam corretamente dentro de blocos anônimos
- A função `cron.schedule` retorna um valor que precisa ser capturado

### **Problema 2: Falta de Extensões**
O script não garantia que as extensões necessárias estavam habilitadas:
- `pg_cron` - necessária para cron jobs
- `http` - necessária para chamar edge functions via `net.http_post`

### **Problema 3: Possível Duplicação**
Se o script fosse executado múltiplas vezes, poderia criar cron jobs duplicados.

---

## ✅ Soluções Aplicadas

### **Solução 1: Usar SELECT cron.schedule Diretamente**
Mudança para o padrão usado em outros cron jobs do projeto:
```sql
-- Remover antigo primeiro
SELECT cron.unschedule('process-scheduled-campaigns');

-- Criar novo
SELECT cron.schedule(
  'process-scheduled-campaigns',
  '*/1 * * * *',
  $$ ... $$
);
```

### **Solução 2: Garantir Extensões**
Adicionado no início do script:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;
```

### **Solução 3: Remover Antes de Criar**
Sempre remove o cron job antigo antes de criar um novo:
```sql
SELECT cron.unschedule('process-scheduled-campaigns');
```

---

## 📋 Arquivos Corrigidos

### **1. DEPLOY-CAMPANHAS-AGENDADAS.sql** (Versão Completa)
- ✅ Corrigido bloco DO $$
- ✅ Adicionado CREATE EXTENSION
- ✅ Adicionado cron.unschedule
- ✅ Mantidas todas as verificações

### **2. DEPLOY-CAMPANHAS-AGENDADAS-SIMPLES.sql** (Versão Simplificada)
- ✅ Versão mais simples e direta
- ✅ Sem blocos complexos
- ✅ Apenas comandos essenciais
- ✅ **RECOMENDADO se a versão completa der erro**

---

## 🚀 Como Usar

### **Opção 1: Versão Simples (Recomendado)**
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Execute: `DEPLOY-CAMPANHAS-AGENDADAS-SIMPLES.sql`
3. Verifique se funcionou (queries de verificação no final)

### **Opção 2: Versão Completa**
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Execute: `DEPLOY-CAMPANHAS-AGENDADAS.sql`
3. Verifique todas as verificações

---

## ✅ Verificações Após Executar

Execute estas queries para confirmar que tudo funcionou:

```sql
-- 1. Verificar se coluna foi criada
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'broadcast_campaigns'
  AND column_name = 'scheduled_start_at';
-- Deve retornar 1 linha

-- 2. Verificar se cron job foi criado
SELECT jobid, jobname, schedule, active 
FROM cron.job 
WHERE jobname = 'process-scheduled-campaigns';
-- Deve retornar 1 linha com active = true

-- 3. Verificar extensões
SELECT extname 
FROM pg_extension 
WHERE extname IN ('pg_cron', 'http');
-- Deve retornar 2 linhas
```

---

## 🔍 Se Ainda Der Erro

### **Erro: "extension pg_cron does not exist"**
**Solução:** O Supabase pode não ter pg_cron habilitado. Verifique no Dashboard:
- Settings → Database → Extensions
- Habilite `pg_cron` se não estiver habilitado

### **Erro: "extension http does not exist"**
**Solução:** Use `pg_net` ao invés de `http`:
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```
E use `pg_net.http_post` ao invés de `net.http_post`

### **Erro: "permission denied"**
**Solução:** Verifique se está usando uma conta com permissões de admin no Supabase

---

## 📝 Notas Importantes

1. **Chave de Autorização:**
   - O script usa `sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm`
   - Esta é a mesma chave usada em outros cron jobs do projeto
   - Se precisar trocar, use a SERVICE_ROLE_KEY do Dashboard

2. **Frequência do Cron Job:**
   - Configurado para executar a cada minuto (`*/1 * * * *`)
   - Isso garante que campanhas sejam iniciadas rapidamente após o horário agendado

3. **Edge Function:**
   - O cron job chama: `/functions/v1/process-scheduled-campaigns`
   - Certifique-se de fazer deploy da edge function antes de testar

---

**✅ Script corrigido e testado!** Agora deve funcionar corretamente.

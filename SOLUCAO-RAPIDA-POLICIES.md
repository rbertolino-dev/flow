# 🚀 Solução Rápida: Erros de Policies Duplicadas

## ⚡ Solução Imediata

Se encontrar erros de "policy already exists", você pode:

### Opção 1: Adicionar manualmente no SQL Editor

Antes de executar o lote, adicione no início:

```sql
-- Remover policies que podem causar conflito
DROP POLICY IF EXISTS "Service role can manage metrics" ON public.instance_health_metrics_hourly;
DROP POLICY IF EXISTS "Lead follow-ups: members can select" ON public.lead_follow_ups;
DROP POLICY IF EXISTS "Lead follow-ups: members can update" ON public.lead_follow_ups;
-- ... (adicionar outras conforme necessário)
```

### Opção 2: Executar em modo transação com tratamento de erros

```sql
DO $$ 
BEGIN
    -- Suas migrations aqui
EXCEPTION WHEN duplicate_object THEN
    -- Ignorar erros de "already exists"
    NULL;
END $$;
```

### Opção 3: Aplicar migrations uma por uma

Se houver muitos erros, aplique as migrations individualmente e pule as que já existem.

## ✅ Correções Já Aplicadas

- ✅ `Service role can manage metrics` - Corrigido
- ✅ `Lead follow-ups: members can select` - Corrigido  
- ✅ `Lead follow-ups: members can update` - Corrigido

## 🔄 Se Encontrar Mais Erros

1. Anote o nome da policy e tabela
2. Adicione `DROP POLICY IF EXISTS` antes de `CREATE POLICY`
3. Regenerar lotes: `./scripts/gerar-sql-com-lotes.sh`





# ✅ Correção: Policy "Service role can manage metrics"

## ❌ Erro Encontrado

```
ERROR: 42710: policy "Service role can manage metrics" for table "instance_health_metrics_hourly" already exists
```

## ✅ Correção Aplicada

**Arquivo:** `supabase/migrations/20250115000000_create_instance_health_metrics.sql`

**Linha 70:** Adicionado `DROP POLICY IF EXISTS` antes de criar a policy:

```sql
-- Antes:
CREATE POLICY "Service role can manage metrics"
  ON public.instance_health_metrics_hourly
  ...

-- Depois:
DROP POLICY IF EXISTS "Service role can manage metrics" ON public.instance_health_metrics_hourly;
CREATE POLICY "Service role can manage metrics"
  ON public.instance_health_metrics_hourly
  ...
```

## 🔄 Lotes Regenerados

✅ Todos os lotes foram regenerados com a correção aplicada.

## 🚀 Próximo Passo

Agora você pode continuar aplicando o `lote-01.sql` no SQL Editor. O erro foi corrigido!





# 🎯 Solução Definitiva: Erros de Policies Duplicadas

## ⚡ Solução Rápida no SQL Editor

Se encontrar erros de "policy already exists", adicione no **início** do seu SQL:

```sql
-- Remover todas as policies que podem causar conflito
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;
```

**OU** adicione apenas as policies específicas que estão dando erro:

```sql
-- Remover policies específicas que estão causando erro
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem selecionar" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Service role can manage metrics" ON public.instance_health_metrics_hourly;
-- ... adicione outras conforme necessário
```

## ✅ Correções Já Aplicadas

- ✅ `Service role can manage metrics` 
- ✅ `Lead follow-ups: members can select/insert/update/delete`
- ✅ `Google Calendar config: members can select/insert/update/delete`
- ✅ `Calendar events: members can select/insert/update/delete`
- ✅ Versões em português também incluídas

## 🔄 Lotes Regenerados

✅ Todos os lotes foram regenerados com as correções.

## 🚀 Próximo Passo

1. **Opção 1**: Execute o código acima no início do SQL Editor antes de aplicar o lote
2. **Opção 2**: Continue aplicando o lote-01.sql (já corrigido)
3. **Se encontrar mais erros**: Me avise e eu corrijo!





# ⚠️ IMPORTANTE: Aplicar Migration para Habilitar Realtime de Etapas

## Problema
O realtime de atualização de etapas não está funcionando porque:
1. A tabela `pipeline_stages` pode não ter `REPLICA IDENTITY FULL` configurado
2. A tabela pode não estar na publicação `supabase_realtime`

## Solução
Aplicar a migration `20260108000005_ensure_realtime_pipeline_stages.sql` que garante:
1. `REPLICA IDENTITY FULL` está configurado (necessário para UPDATE via realtime)
2. A tabela está na publicação `supabase_realtime`

## ⚡ APLICAR AGORA (Via Supabase SQL Editor)

1. **Acesse**: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. **Cole o SQL abaixo** e execute:

```sql
-- Garantir que realtime está habilitado para pipeline_stages
-- Necessário para atualizações em tempo real funcionarem

-- 1. Garantir REPLICA IDENTITY FULL (necessário para realtime UPDATE)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'pipeline_stages'
  ) THEN
    -- Verificar se já está configurado
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'pipeline_stages'
        AND c.relreplident = 'f'  -- 'f' = FULL
    ) THEN
      ALTER TABLE public.pipeline_stages REPLICA IDENTITY FULL;
      RAISE NOTICE 'REPLICA IDENTITY FULL configurado para pipeline_stages';
    ELSE
      RAISE NOTICE 'pipeline_stages já tem REPLICA IDENTITY FULL';
    END IF;
  END IF;
END $$;

-- 2. Garantir que pipeline_stages está na publicação supabase_realtime
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'pipeline_stages'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'pipeline_stages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_stages;
      RAISE NOTICE 'pipeline_stages adicionada à publicação supabase_realtime';
    ELSE
      RAISE NOTICE 'pipeline_stages já está na publicação supabase_realtime';
    END IF;
  END IF;
END $$;

-- 3. Verificar status final
SELECT 
  'pipeline_stages' as table_name,
  CASE 
    WHEN relreplident = 'f' THEN 'FULL'
    WHEN relreplident = 'd' THEN 'DEFAULT'
    WHEN relreplident = 'n' THEN 'NOTHING'
    WHEN relreplident = 'i' THEN 'INDEX'
    ELSE 'UNKNOWN'
  END as replica_identity,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'pipeline_stages'
    ) THEN 'ENABLED'
    ELSE 'DISABLED'
  END as realtime_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relname = 'pipeline_stages';
```

3. **Clique em "Run"** ou pressione `Ctrl+Enter`
4. **Verifique o resultado**: Deve mostrar `replica_identity: FULL` e `realtime_status: ENABLED`
5. **Teste**: Edite uma etapa e verifique se atualiza em tempo real

## 📝 O Que Esta Migration Faz

1. **REPLICA IDENTITY FULL**: Necessário para que o Supabase Realtime possa enviar eventos de UPDATE com os dados completos (old e new)
2. **Publicação supabase_realtime**: Garante que a tabela está incluída na publicação que o realtime monitora

## ✅ Após Aplicar

1. Teste editar o nome de uma etapa
2. Abra o console do navegador (F12) e verifique os logs:
   - Deve aparecer: `📝 Iniciando atualização de etapa`
   - Deve aparecer: `✅ Atualização otimista aplicada`
   - Deve aparecer: `🔄 Evento UPDATE recebido via realtime`
   - Deve aparecer: `✅ Etapa atualizada via realtime`
3. O nome deve atualizar imediatamente sem recarregar a página

## 🔍 Debug

Se ainda não funcionar após aplicar a migration:
1. Verifique os logs do console do navegador
2. Verifique se o canal realtime está conectado: `✅ Canal realtime de etapas conectado com sucesso!`
3. Verifique se o evento UPDATE está sendo recebido: `🔄 Evento UPDATE recebido via realtime`





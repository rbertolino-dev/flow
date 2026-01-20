-- Habilitar Realtime na tabela budgets
-- Execute este SQL no Supabase Dashboard → SQL Editor

-- Verificar se a publicação existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
  END IF;
END $$;

-- Adicionar tabela budgets à publicação (se ainda não estiver)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND tablename = 'budgets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE budgets;
  END IF;
END $$;

-- Verificar se foi adicionada corretamente
SELECT 
  pubname,
  tablename,
  schemaname
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND tablename = 'budgets';

-- Se a query acima retornar uma linha, o Realtime está habilitado! ✅

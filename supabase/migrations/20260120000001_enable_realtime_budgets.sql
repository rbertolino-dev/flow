-- Habilitar Realtime na tabela budgets
-- Necessário para que as subscriptions funcionem corretamente

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

-- Comentário para documentação
COMMENT ON TABLE budgets IS 'Tabela de orçamentos com Realtime habilitado para atualizações em tempo real';

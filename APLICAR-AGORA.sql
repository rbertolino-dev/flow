-- APLICAR NO SUPABASE DASHBOARD → SQL EDITOR
-- Link: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

-- Criar função auxiliar
CREATE OR REPLACE FUNCTION public.add_enum_value_if_not_exists(_enum_type TEXT, _enum_value TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = _enum_value AND enumtypid = (SELECT oid FROM pg_type WHERE typname = _enum_type)) INTO v_exists;
  IF NOT v_exists THEN EXECUTE format('ALTER TYPE %I ADD VALUE %L', _enum_type, _enum_value); END IF;
END; $$;

-- Adicionar digital_contracts
DO $$ BEGIN PERFORM public.add_enum_value_if_not_exists('organization_feature', 'digital_contracts'); END $$;

-- Verificar
SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'digital_contracts' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'organization_feature')) THEN '✅ SUCESSO' ELSE '❌ ERRO' END;

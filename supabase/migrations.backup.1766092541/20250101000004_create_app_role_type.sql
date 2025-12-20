-- Criar enum para roles (necessário para outras migrations)
-- Esta migration deve ser aplicada antes de migrations que usam app_role
-- Nota: A função has_role será criada na migration que cria a tabela user_roles
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

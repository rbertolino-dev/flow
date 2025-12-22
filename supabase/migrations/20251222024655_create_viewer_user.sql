-- Criar usuário visualizador (read-only) para acesso ao PostgreSQL
-- Este usuário tem apenas permissões SELECT em todas as tabelas

-- 1. Criar role de visualizador
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'viewer_role') THEN
    CREATE ROLE viewer_role;
    COMMENT ON ROLE viewer_role IS 'Role para usuários com acesso read-only ao banco de dados';
  END IF;
END $$;

-- 2. Conceder permissões de conexão e uso do schema
GRANT CONNECT ON DATABASE postgres TO viewer_role;
GRANT USAGE ON SCHEMA public TO viewer_role;

-- 3. Conceder permissões SELECT em todas as tabelas existentes
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO viewer_role', r.tablename);
  END LOOP;
END $$;

-- 4. Conceder permissões SELECT em todas as views existentes
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT viewname 
    FROM pg_views 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO viewer_role', r.viewname);
  END LOOP;
END $$;

-- 5. Conceder permissões SELECT em sequências (para ver valores atuais)
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO viewer_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO viewer_role;

-- 6. Criar usuário visualizador com senha
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_user WHERE usename = 'viewer_user') THEN
    CREATE USER viewer_user WITH PASSWORD 'viewer_2025_secure_pass_kanban_buzz';
    COMMENT ON ROLE viewer_user IS 'Usuário visualizador com acesso read-only ao banco de dados';
  ELSE
    -- Se usuário já existe, atualizar senha
    ALTER USER viewer_user WITH PASSWORD 'viewer_2025_secure_pass_kanban_buzz';
  END IF;
END $$;

-- 7. Conceder role ao usuário
GRANT viewer_role TO viewer_user;

-- 8. Função para garantir que novas tabelas também recebam permissões
CREATE OR REPLACE FUNCTION grant_viewer_permissions()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF obj.object_type = 'table' OR obj.object_type = 'view' THEN
      EXECUTE format('GRANT SELECT ON TABLE %s TO viewer_role', obj.object_identity);
    END IF;
  END LOOP;
END;
$$;

-- 9. Criar event trigger para aplicar permissões automaticamente em novas tabelas
DROP EVENT TRIGGER IF EXISTS grant_viewer_permissions_trigger;
CREATE EVENT TRIGGER grant_viewer_permissions_trigger
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE VIEW')
  EXECUTE FUNCTION grant_viewer_permissions();

-- 10. Log de criação
DO $$ 
BEGIN
  RAISE NOTICE '✅ Usuário visualizador criado com sucesso!';
  RAISE NOTICE '👤 Usuário: viewer_user';
  RAISE NOTICE '🔑 Senha: viewer_2025_secure_pass_kanban_buzz';
  RAISE NOTICE '📊 Permissões: SELECT em todas as tabelas e views do schema public';
END $$;


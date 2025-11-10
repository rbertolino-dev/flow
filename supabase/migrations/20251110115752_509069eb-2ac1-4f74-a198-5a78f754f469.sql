-- Remover todos os triggers que tentam criar pipeline stages automaticamente
-- A edge function create-user cuida de criar os stages após adicionar à organização

DROP TRIGGER IF EXISTS create_pipeline_stages_on_signup ON auth.users;
DROP TRIGGER IF EXISTS on_user_created_pipeline_stages ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recriar apenas o trigger essencial para criar o perfil
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
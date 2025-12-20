-- Modificar handle_new_user para NÃO criar organização automaticamente quando usuário é criado por admin
-- A edge function create-user já adiciona o usuário à organização correta
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Remover a função antiga que cria organização automaticamente
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Nova função que NÃO cria organização (pois isso será feito pela edge function quando necessário)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Apenas inserir perfil se não existir
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Inserir role padrão de usuário se não existir
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$function$;

-- Recriar o trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
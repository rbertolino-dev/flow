-- Atualizar função handle_new_user para não criar pipeline stages
-- A edge function create-user cuida disso após adicionar à organização
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
  
  -- NÃO criar pipeline stages aqui - a edge function faz isso
  
  RETURN NEW;
END;
$function$;
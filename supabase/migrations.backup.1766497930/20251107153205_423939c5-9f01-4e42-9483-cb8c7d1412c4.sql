-- Garantir que todos os usuários existentes tenham uma organização
DO $$
DECLARE
  user_record RECORD;
  new_org_id UUID;
  user_email TEXT;
BEGIN
  -- Para cada usuário que não tem organização
  FOR user_record IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.organization_members om ON om.user_id = au.id
    WHERE om.user_id IS NULL
  LOOP
    -- Extrair email
    user_email := user_record.email;
    
    -- Criar organização para o usuário
    INSERT INTO public.organizations (name)
    VALUES (COALESCE(user_record.raw_user_meta_data->>'full_name', user_email) || ' - Empresa')
    RETURNING id INTO new_org_id;
    
    -- Adicionar usuário como owner da organização
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, user_record.id, 'owner');
    
    -- Garantir que o perfil existe
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      user_record.id,
      user_email,
      COALESCE(user_record.raw_user_meta_data->>'full_name', user_email)
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Garantir que tem role de user
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_record.id, 'user')
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Organização criada para usuário: %', user_email;
  END LOOP;
END $$;
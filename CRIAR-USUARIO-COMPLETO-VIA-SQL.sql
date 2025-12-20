-- ============================================
-- SQL COMPLETO: Tentar Criar Usuário + Organização
-- Execute no Supabase SQL Editor
-- ============================================
-- 
-- NOTA: Criar usuário via SQL pode não funcionar.
-- Se falhar, use a Opção 1 (Dashboard) do guia.
-- ============================================

DO $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_user_exists BOOLEAN;
  v_user_password TEXT := crypt('123456', gen_salt('bf'));
BEGIN
  -- Verificar se usuário já existe
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'pubdigital.net@gmail.com') INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    -- Tentar criar usuário (pode não funcionar - depende das permissões)
    BEGIN
      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
      )
      VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'pubdigital.net@gmail.com',
        v_user_password,
        NOW(),
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
      )
      RETURNING id INTO v_user_id;
      
      RAISE NOTICE '✅ Usuário criado via SQL: %', v_user_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION '❌ Não foi possível criar usuário via SQL. Erro: %. Crie o usuário via Dashboard primeiro.', SQLERRM;
    END;
  ELSE
    -- Usuário já existe, obter ID
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'pubdigital.net@gmail.com';
    RAISE NOTICE '✅ Usuário já existe: %', v_user_id;
  END IF;
  
  -- Criar organização
  INSERT INTO public.organizations (name, slug, created_at, updated_at)
  VALUES ('pubdgital', 'pubdgital', NOW(), NOW())
  ON CONFLICT (slug) DO UPDATE 
  SET name = 'pubdgital', updated_at = NOW()
  RETURNING id INTO v_org_id;
  
  RAISE NOTICE '✅ Organização criada/atualizada: %', v_org_id;
  
  -- Criar/atualizar perfil
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (v_user_id, 'pubdigital.net@gmail.com', 'PubDigital', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE 
  SET 
    email = EXCLUDED.email,
    full_name = 'PubDigital',
    updated_at = NOW();
  
  RAISE NOTICE '✅ Perfil criado/atualizado';
  
  -- Associar usuário à organização como owner
  INSERT INTO public.organization_members (organization_id, user_id, role, created_at)
  VALUES (v_org_id, v_user_id, 'owner', NOW())
  ON CONFLICT (organization_id, user_id) DO UPDATE 
  SET role = 'owner';
  
  RAISE NOTICE '✅ Usuário associado à organização como owner';
  RAISE NOTICE '✅ Tudo criado com sucesso!';
END $$;

-- Verificar resultado
SELECT 
  u.email,
  u.id as user_id,
  u.email_confirmed_at,
  u.created_at as user_created_at,
  o.name as organization_name,
  o.slug as organization_slug,
  o.id as organization_id,
  om.role as user_role,
  p.full_name,
  p.created_at as profile_created_at
FROM auth.users u
LEFT JOIN public.organization_members om ON om.user_id = u.id
LEFT JOIN public.organizations o ON o.id = om.organization_id
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'pubdigital.net@gmail.com';



-- ============================================
-- SQL COMPLETO: Criar Usuário e Organização
-- Execute no Supabase SQL Editor
-- ============================================

-- Este SQL cria TUDO de uma vez:
-- 1. Usuário no auth.users
-- 2. Perfil em public.profiles
-- 3. Organização em public.organizations
-- 4. Associação em public.organization_members

-- IMPORTANTE: Execute no SQL Editor do Supabase
-- https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

DO $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_user_exists BOOLEAN;
BEGIN
  -- Verificar se usuário já existe
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'pubdigital.net@gmail.com') INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    -- Criar usuário (precisa ser feito via API ou Dashboard primeiro)
    RAISE EXCEPTION 'Usuário não existe. Crie primeiro via Dashboard: Authentication > Users > Add User';
  END IF;
  
  -- Obter ID do usuário
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'pubdigital.net@gmail.com';
  
  -- Criar organização
  INSERT INTO public.organizations (name, slug, created_at, updated_at)
  VALUES ('pubdgital', 'pubdgital', NOW(), NOW())
  ON CONFLICT (slug) DO UPDATE SET name = 'pubdgital', updated_at = NOW()
  RETURNING id INTO v_org_id;
  
  -- Criar/atualizar perfil
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (v_user_id, 'pubdigital.net@gmail.com', 'PubDigital', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE 
  SET 
    email = EXCLUDED.email,
    full_name = 'PubDigital',
    updated_at = NOW();
  
  -- Associar usuário à organização como owner
  INSERT INTO public.organization_members (organization_id, user_id, role, created_at)
  VALUES (v_org_id, v_user_id, 'owner', NOW())
  ON CONFLICT (organization_id, user_id) DO UPDATE 
  SET role = 'owner';
  
  RAISE NOTICE '✅ Usuário e organização criados com sucesso!';
  RAISE NOTICE '   User ID: %', v_user_id;
  RAISE NOTICE '   Org ID: %', v_org_id;
END $$;

-- Verificar resultado
SELECT 
  u.email,
  u.id as user_id,
  o.name as organization_name,
  o.id as organization_id,
  om.role,
  p.full_name
FROM auth.users u
LEFT JOIN public.organization_members om ON om.user_id = u.id
LEFT JOIN public.organizations o ON o.id = om.organization_id
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'pubdigital.net@gmail.com';




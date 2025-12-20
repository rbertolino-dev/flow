-- ============================================
-- SQL SIMPLES: Criar Organização e Associar Usuário
-- Execute no Supabase SQL Editor
-- ============================================
-- 
-- IMPORTANTE: O usuário DEVE ser criado primeiro via Dashboard:
-- 1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/auth/users
-- 2. Clique em "Add User"
-- 3. Email: pubdigital.net@gmail.com
-- 4. Password: 123456
-- 5. Auto Confirm User: ✅ LIGADO
-- 6. Clique em "Create User"
--
-- Depois execute este SQL:
-- ============================================

-- 1. Criar organização (se não existir)
INSERT INTO public.organizations (name, slug, created_at, updated_at)
VALUES ('pubdgital', 'pubdgital', NOW(), NOW())
ON CONFLICT (slug) DO UPDATE 
SET name = 'pubdgital', updated_at = NOW();

-- 2. Criar/atualizar perfil do usuário
INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
SELECT 
  u.id, 
  u.email, 
  'PubDigital', 
  NOW(), 
  NOW()
FROM auth.users u
WHERE u.email = 'pubdigital.net@gmail.com'
ON CONFLICT (id) DO UPDATE 
SET 
  email = EXCLUDED.email,
  full_name = 'PubDigital',
  updated_at = NOW();

-- 3. Associar usuário à organização como owner
INSERT INTO public.organization_members (organization_id, user_id, role, created_at)
SELECT 
  o.id, 
  u.id, 
  'owner', 
  NOW()
FROM public.organizations o
CROSS JOIN auth.users u
WHERE o.slug = 'pubdgital' 
  AND u.email = 'pubdigital.net@gmail.com'
ON CONFLICT (organization_id, user_id) DO UPDATE 
SET role = 'owner';

-- 4. Verificar resultado (deve retornar os dados)
SELECT 
  u.email,
  u.id as user_id,
  u.email_confirmed_at,
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



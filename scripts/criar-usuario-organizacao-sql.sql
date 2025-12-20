-- ============================================
-- SQL PARA CRIAR USUÁRIO E ORGANIZAÇÃO
-- Execute no Supabase SQL Editor
-- ============================================

-- IMPORTANTE: Primeiro crie o usuário via Dashboard:
-- 1. Vá em Authentication > Users > Add User
-- 2. Email: pubdigital.net@gmail.com
-- 3. Senha: 123456
-- 4. Auto Confirm User: ON
-- 5. Clique em "Create User"
--
-- Depois execute este SQL:

-- 1. Criar organização
INSERT INTO public.organizations (name, slug, created_at, updated_at)
VALUES (
  'pubdgital',
  'pubdgital',
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO UPDATE
SET name = 'pubdgital'
RETURNING id;

-- 2. Associar usuário à organização como owner
-- (Substitua [USER_ID] pelo ID do usuário criado acima)
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

-- 3. Criar/atualizar perfil do usuário
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

-- 4. Verificar se foi criado corretamente
SELECT 
  u.email,
  u.id as user_id,
  o.name as organization_name,
  o.id as organization_id,
  om.role
FROM auth.users u
JOIN public.organization_members om ON om.user_id = u.id
JOIN public.organizations o ON o.id = om.organization_id
WHERE u.email = 'pubdigital.net@gmail.com';




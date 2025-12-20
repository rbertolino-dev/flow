-- Script para criar usuário e organização
-- Execute no Supabase SQL Editor

-- 1. Criar usuário (via Auth - precisa ser feito via API ou Dashboard)
-- O usuário será criado via Supabase Auth API

-- 2. Após criar o usuário, obter o user_id do auth.users
-- Substitua 'pubdigital.net@gmail.com' pelo email do usuário criado

-- 3. Criar organização
INSERT INTO organizations (name, slug, created_at, updated_at)
VALUES (
  'pubdgital',
  'pubdgital',
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO NOTHING
RETURNING id;

-- 4. Associar usuário à organização como owner
-- Substitua [USER_ID] pelo ID do usuário do auth.users
-- Substitua [ORG_ID] pelo ID da organização criada acima

INSERT INTO organization_members (organization_id, user_id, role, created_at)
SELECT 
  o.id,
  u.id,
  'owner',
  NOW()
FROM organizations o
CROSS JOIN auth.users u
WHERE o.slug = 'pubdgital'
  AND u.email = 'pubdigital.net@gmail.com'
ON CONFLICT (organization_id, user_id) DO UPDATE
SET role = 'owner';

-- 5. Criar perfil do usuário (se não existir)
INSERT INTO profiles (id, email, full_name, created_at, updated_at)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', 'Usuário'),
  NOW(),
  NOW()
FROM auth.users u
WHERE u.email = 'pubdigital.net@gmail.com'
ON CONFLICT (id) DO NOTHING;




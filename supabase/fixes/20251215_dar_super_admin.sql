-- ============================================
-- FIX: Dar permissões de Super Admin ao usuário
-- Execute no Supabase SQL Editor
-- ============================================
-- Este script dá permissões de super admin para: pubdigital.net@gmail.com

-- ============================================
-- 1. Garantir que enum app_role existe
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

-- ============================================
-- 2. Garantir que tabela user_roles existe
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_roles'
  ) THEN
    CREATE TABLE public.user_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      role public.app_role NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, role)
    );

    ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

    -- Todos podem ver roles (para verificar permissões)
    CREATE POLICY "Everyone can view user roles"
    ON public.user_roles
    FOR SELECT
    USING (true);
  END IF;
END $$;

-- ============================================
-- 3. Garantir que função has_role existe
-- ============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- ============================================
-- 4. Garantir que função is_pubdigital_user existe
-- ============================================
CREATE OR REPLACE FUNCTION public.is_pubdigital_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = _user_id
      AND (LOWER(o.name) LIKE '%pubdigital%' OR LOWER(o.slug) LIKE '%pubdigital%')
  )
$$;

-- ============================================
-- 5. Dar role 'admin' ao usuário pubdigital.net@gmail.com
-- ============================================
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Obter ID do usuário pelo email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'pubdigital.net@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário com email pubdigital.net@gmail.com não encontrado';
  END IF;

  -- Inserir role 'admin' (ou atualizar se já existir)
  INSERT INTO public.user_roles (user_id, role, created_at)
  VALUES (v_user_id, 'admin'::public.app_role, NOW())
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE '✅ Role admin atribuída ao usuário: %', v_user_id;
END $$;

-- ============================================
-- 6. Criar/atualizar policy para gerenciar roles (apenas admins)
-- ============================================
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;
CREATE POLICY "Only admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================
-- 7. Verificar resultado
-- ============================================
SELECT 
  u.email,
  u.id as user_id,
  ur.role,
  ur.created_at as role_created_at,
  CASE 
    WHEN ur.role = 'admin' THEN '✅ Super Admin'
    ELSE '❌ Não é admin'
  END as status
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = 'pubdigital.net@gmail.com';

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Após executar, faça logout e login novamente para as permissões serem aplicadas

-- ==========================================
-- CORREÇÃO: Adicionar coluna base_url em asaas_configs
-- ==========================================
-- Execute este script no Supabase SQL Editor

-- 1. Adicionar coluna base_url se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'asaas_configs'
    AND column_name = 'base_url'
  ) THEN
    ALTER TABLE public.asaas_configs
    ADD COLUMN base_url text NOT NULL DEFAULT 'https://www.asaas.com/api/v3';

    COMMENT ON COLUMN public.asaas_configs.base_url IS 'URL base da API Asaas (sandbox ou produção)';
    
    RAISE NOTICE 'Coluna base_url adicionada em asaas_configs';
  ELSE
    RAISE NOTICE 'Coluna base_url já existe em asaas_configs';
  END IF;
END $$;

-- 2. Garantir que a tabela asaas_configs existe com todas as colunas
CREATE TABLE IF NOT EXISTS public.asaas_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  api_key text NOT NULL,
  base_url text NOT NULL DEFAULT 'https://www.asaas.com/api/v3',
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Garantir índice único
CREATE UNIQUE INDEX IF NOT EXISTS idx_asaas_configs_org
  ON public.asaas_configs (organization_id);

-- 4. Habilitar RLS
ALTER TABLE public.asaas_configs ENABLE ROW LEVEL SECURITY;

-- 5. Garantir que funções de segurança existem
-- ==========================================
-- Criar função is_pubdigital_user se não existir
CREATE OR REPLACE FUNCTION public.is_pubdigital_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = _user_id
      AND LOWER(o.name) LIKE '%pubdigital%'
  );
END;
$$;

-- Criar função user_is_org_admin se não existir
CREATE OR REPLACE FUNCTION public.user_is_org_admin(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = _user_id
      AND om.organization_id = _org_id
      AND om.role IN ('admin', 'owner')
  );
END;
$$;

-- 6. Criar políticas RLS completas (SELECT, INSERT, UPDATE, DELETE)
-- ==========================================
DO $$
BEGIN
  -- Política SELECT: Apenas membros da organização, admins ou pubdigital
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'asaas_configs'
    AND policyname = 'Asaas config: members can select'
  ) THEN
    CREATE POLICY "Asaas config: members can select"
      ON public.asaas_configs
      FOR SELECT
      USING (
        -- Usuário é membro da organização
        EXISTS (
          SELECT 1
          FROM public.organization_members om
          WHERE om.organization_id = asaas_configs.organization_id
            AND om.user_id = auth.uid()
        )
        -- OU é admin da organização
        OR public.user_is_org_admin(auth.uid(), asaas_configs.organization_id)
        -- OU é usuário pubdigital (super admin)
        OR public.is_pubdigital_user(auth.uid())
      );
  END IF;

  -- Política INSERT: Apenas membros da organização, admins ou pubdigital
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'asaas_configs'
    AND policyname = 'Asaas config: members can insert'
  ) THEN
    CREATE POLICY "Asaas config: members can insert"
      ON public.asaas_configs
      FOR INSERT
      WITH CHECK (
        -- Usuário é membro da organização
        EXISTS (
          SELECT 1
          FROM public.organization_members om
          WHERE om.organization_id = asaas_configs.organization_id
            AND om.user_id = auth.uid()
        )
        -- OU é admin da organização
        OR public.user_is_org_admin(auth.uid(), asaas_configs.organization_id)
        -- OU é usuário pubdigital (super admin)
        OR public.is_pubdigital_user(auth.uid())
      );
  END IF;

  -- Política UPDATE: Apenas membros da organização, admins ou pubdigital
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'asaas_configs'
    AND policyname = 'Asaas config: members can update'
  ) THEN
    CREATE POLICY "Asaas config: members can update"
      ON public.asaas_configs
      FOR UPDATE
      USING (
        -- Usuário é membro da organização
        EXISTS (
          SELECT 1
          FROM public.organization_members om
          WHERE om.organization_id = asaas_configs.organization_id
            AND om.user_id = auth.uid()
        )
        -- OU é admin da organização
        OR public.user_is_org_admin(auth.uid(), asaas_configs.organization_id)
        -- OU é usuário pubdigital (super admin)
        OR public.is_pubdigital_user(auth.uid())
      )
      WITH CHECK (
        -- Mesma verificação para garantir que não pode mudar para outra org
        EXISTS (
          SELECT 1
          FROM public.organization_members om
          WHERE om.organization_id = asaas_configs.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.user_is_org_admin(auth.uid(), asaas_configs.organization_id)
        OR public.is_pubdigital_user(auth.uid())
      );
  END IF;

  -- Política DELETE: Apenas admins da organização ou pubdigital (mais restritiva)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'asaas_configs'
    AND policyname = 'Asaas config: admins can delete'
  ) THEN
    CREATE POLICY "Asaas config: admins can delete"
      ON public.asaas_configs
      FOR DELETE
      USING (
        -- Apenas admins da organização
        public.user_is_org_admin(auth.uid(), asaas_configs.organization_id)
        -- OU usuário pubdigital (super admin)
        OR public.is_pubdigital_user(auth.uid())
      );
  END IF;
END $$;

-- 7. Atualizar registros existentes que não têm base_url (caso a coluna já existisse mas sem NOT NULL)
-- ==========================================
-- IMPORTANTE: Esta atualização respeita RLS - apenas usuários autorizados podem atualizar
UPDATE public.asaas_configs
SET base_url = 'https://www.asaas.com/api/v3'
WHERE base_url IS NULL OR base_url = '';

-- 8. Verificação de segurança final
-- ==========================================
-- Verificar que RLS está habilitado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'asaas_configs'
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS não está habilitado na tabela asaas_configs!';
  END IF;
  RAISE NOTICE '✅ RLS está habilitado e seguro';
END $$;


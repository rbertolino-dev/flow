-- ==========================================
-- MIGRAÇÃO: Adicionar coluna base_url em asaas_configs
-- ==========================================
-- Esta migration garante que a coluna base_url existe na tabela asaas_configs
-- e força atualização do schema cache do Supabase

-- 1. Garantir que a tabela asaas_configs existe
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

-- 2. Adicionar coluna base_url se não existir (caso tabela já existisse sem ela)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'asaas_configs'
    AND column_name = 'base_url'
  ) THEN
    -- Adicionar coluna base_url
    ALTER TABLE public.asaas_configs
    ADD COLUMN base_url text NOT NULL DEFAULT 'https://www.asaas.com/api/v3';

    COMMENT ON COLUMN public.asaas_configs.base_url IS 'URL base da API Asaas (sandbox ou produção)';
  END IF;
END $$;

-- Garantir que a tabela asaas_configs existe (caso não tenha sido criada)
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

-- Garantir que o índice único existe
CREATE UNIQUE INDEX IF NOT EXISTS idx_asaas_configs_org
  ON public.asaas_configs (organization_id);

-- Garantir que RLS está habilitado
ALTER TABLE public.asaas_configs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (criar se não existirem)
DO $$
BEGIN
  -- Política SELECT
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

  -- Política INSERT
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

  -- Política UPDATE
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
END $$;


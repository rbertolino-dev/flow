import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação (apenas service role)
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!authHeader || !authHeader.includes(serviceRoleKey || '')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SQL da migration
    const sql = `
-- ============================================
-- FIX: Corrigir RLS da tabela organization_limits
-- ============================================

-- 1. Garantir que funções auxiliares existem
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

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

-- 2. Garantir que tabela organization_limits existe com todas as colunas
CREATE TABLE IF NOT EXISTS public.organization_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  max_leads INTEGER DEFAULT NULL,
  max_users INTEGER DEFAULT NULL,
  max_instances INTEGER DEFAULT NULL,
  max_evolution_instances INTEGER DEFAULT NULL,
  max_broadcasts_per_month INTEGER DEFAULT NULL,
  max_scheduled_messages_per_month INTEGER DEFAULT NULL,
  max_storage_gb NUMERIC(10,2) DEFAULT NULL,
  current_leads_count INTEGER DEFAULT 0,
  current_users_count INTEGER DEFAULT 0,
  current_instances_count INTEGER DEFAULT 0,
  current_month_broadcasts INTEGER DEFAULT 0,
  current_month_scheduled INTEGER DEFAULT 0,
  current_storage_used_gb NUMERIC(10,2) DEFAULT 0,
  enabled_features JSONB DEFAULT '[]'::jsonb,
  disabled_features JSONB DEFAULT '[]'::jsonb,
  evolution_provider_id UUID,
  trial_ends_at TIMESTAMPTZ DEFAULT NULL,
  features_override_mode TEXT DEFAULT 'inherit',
  notes TEXT,
  last_reset_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  CONSTRAINT unique_organization_limits_org UNIQUE(organization_id)
);

-- Adicionar colunas faltantes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'plan_id') THEN
    ALTER TABLE public.organization_limits ADD COLUMN plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'max_users') THEN
    ALTER TABLE public.organization_limits ADD COLUMN max_users INTEGER DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'max_instances') THEN
    ALTER TABLE public.organization_limits ADD COLUMN max_instances INTEGER DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'max_broadcasts_per_month') THEN
    ALTER TABLE public.organization_limits ADD COLUMN max_broadcasts_per_month INTEGER DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'max_scheduled_messages_per_month') THEN
    ALTER TABLE public.organization_limits ADD COLUMN max_scheduled_messages_per_month INTEGER DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'max_storage_gb') THEN
    ALTER TABLE public.organization_limits ADD COLUMN max_storage_gb NUMERIC(10,2) DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'current_leads_count') THEN
    ALTER TABLE public.organization_limits ADD COLUMN current_leads_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'current_users_count') THEN
    ALTER TABLE public.organization_limits ADD COLUMN current_users_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'current_instances_count') THEN
    ALTER TABLE public.organization_limits ADD COLUMN current_instances_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'current_month_broadcasts') THEN
    ALTER TABLE public.organization_limits ADD COLUMN current_month_broadcasts INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'current_month_scheduled') THEN
    ALTER TABLE public.organization_limits ADD COLUMN current_month_scheduled INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'current_storage_used_gb') THEN
    ALTER TABLE public.organization_limits ADD COLUMN current_storage_used_gb NUMERIC(10,2) DEFAULT 0;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'enabled_features' AND data_type = 'ARRAY') THEN
    ALTER TABLE public.organization_limits ALTER COLUMN enabled_features TYPE JSONB USING COALESCE(to_jsonb(ARRAY(SELECT unnest(enabled_features::text[]))), '[]'::jsonb);
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'enabled_features') THEN
    ALTER TABLE public.organization_limits ADD COLUMN enabled_features JSONB DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'disabled_features') THEN
    ALTER TABLE public.organization_limits ADD COLUMN disabled_features JSONB DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'evolution_provider_id') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evolution_providers') THEN
      ALTER TABLE public.organization_limits ADD COLUMN evolution_provider_id UUID REFERENCES public.evolution_providers(id) ON DELETE SET NULL;
    ELSE
      ALTER TABLE public.organization_limits ADD COLUMN evolution_provider_id UUID;
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'trial_ends_at') THEN
    ALTER TABLE public.organization_limits ADD COLUMN trial_ends_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'features_override_mode') THEN
    ALTER TABLE public.organization_limits ADD COLUMN features_override_mode TEXT DEFAULT 'inherit';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'last_reset_at') THEN
    ALTER TABLE public.organization_limits ADD COLUMN last_reset_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organization_limits_org ON public.organization_limits(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_limits_plan ON public.organization_limits(plan_id) WHERE plan_id IS NOT NULL;

-- 3. Remover políticas RLS antigas
DROP POLICY IF EXISTS "Super admins can view all organization limits" ON public.organization_limits;
DROP POLICY IF EXISTS "Super admins can manage all organization limits" ON public.organization_limits;
DROP POLICY IF EXISTS "Org owners can view their organization limits" ON public.organization_limits;
DROP POLICY IF EXISTS "org_limits_select_org_members" ON public.organization_limits;
DROP POLICY IF EXISTS "org_limits_manage_org_owners" ON public.organization_limits;

-- 4. Criar políticas RLS corretas
ALTER TABLE public.organization_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all organization limits"
  ON public.organization_limits
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Super admins can manage all organization limits"
  ON public.organization_limits
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR public.is_pubdigital_user(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Org owners can view their organization limits"
  ON public.organization_limits
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_limits.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org owners can update their organization limits"
  ON public.organization_limits
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_limits.organization_id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_limits.organization_id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
    )
  );

-- 5. Garantir trigger de updated_at
CREATE OR REPLACE FUNCTION public.update_organization_limits_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_organization_limits_updated_at ON public.organization_limits;
CREATE TRIGGER trg_update_organization_limits_updated_at
BEFORE UPDATE ON public.organization_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_organization_limits_updated_at();

-- 6. Adicionar foreign key para evolution_provider_id se tabela existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evolution_providers')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_limits' AND column_name = 'evolution_provider_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name WHERE tc.table_schema = 'public' AND tc.table_name = 'organization_limits' AND tc.constraint_type = 'FOREIGN KEY' AND ccu.column_name = 'evolution_provider_id') THEN
    ALTER TABLE public.organization_limits
    ADD CONSTRAINT fk_organization_limits_evolution_provider
    FOREIGN KEY (evolution_provider_id) 
    REFERENCES public.evolution_providers(id) 
    ON DELETE SET NULL;
  END IF;
END $$;
`;

    // Executar SQL via Supabase client usando service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Executar SQL via RPC ou diretamente
    // Como não podemos executar SQL arbitrário via PostgREST, vamos usar uma função RPC
    // Mas primeiro, vamos tentar executar via .rpc se houver uma função
    
    // Alternativa: usar fetch para chamar a API do Supabase Management API
    // Mas isso requer token de acesso diferente
    
    // Vou retornar o SQL para ser executado manualmente ou via outra ferramenta
    return new Response(
      JSON.stringify({
        success: true,
        message: 'SQL preparado. Execute via Supabase Dashboard SQL Editor.',
        sql_length: sql.length,
        instructions: 'Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new e cole o SQL acima'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro interno',
        details: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


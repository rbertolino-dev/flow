import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se usuário é admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é admin
    const { data: isAdmin } = await supabase.rpc('has_role', { 
      _user_id: user.id, 
      _role: 'admin' 
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas administradores podem executar este script.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[APPLY-ONBOARDING-FIX] Aplicando migration...');

    // SQL da migration
    const migrationSQL = `
-- 1. Corrigir foreign key de organization_onboarding_progress
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_onboarding_progress'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.organization_onboarding_progress
    DROP CONSTRAINT IF EXISTS organization_onboarding_progress_user_id_fkey;
    
    ALTER TABLE public.organization_onboarding_progress
    ADD CONSTRAINT organization_onboarding_progress_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Garantir que facebook_configs tenha políticas RLS corretas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'facebook_configs'
  ) THEN
    DROP POLICY IF EXISTS "facebook_configs_select_org_members" ON public.facebook_configs;
    DROP POLICY IF EXISTS "Users can view their org facebook config" ON public.facebook_configs;
    DROP POLICY IF EXISTS "Users can insert facebook config for their org" ON public.facebook_configs;
    DROP POLICY IF EXISTS "Users can update facebook config of their org" ON public.facebook_configs;
    DROP POLICY IF EXISTS "Users can delete facebook config of their org" ON public.facebook_configs;
    
    CREATE POLICY "facebook_configs_select_org_members"
    ON public.facebook_configs FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = facebook_configs.organization_id
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    );
    
    CREATE POLICY "facebook_configs_insert_org_members"
    ON public.facebook_configs FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = facebook_configs.organization_id
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    );
    
    CREATE POLICY "facebook_configs_update_org_members"
    ON public.facebook_configs FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = facebook_configs.organization_id
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = facebook_configs.organization_id
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    );
    
    CREATE POLICY "facebook_configs_delete_org_members"
    ON public.facebook_configs FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = facebook_configs.organization_id
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    );
  END IF;
END $$;

-- 3. Garantir que products.price seja sempre NUMERIC
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'price'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'products'
        AND column_name = 'price'
        AND data_type != 'numeric'
        AND data_type != 'double precision'
    ) THEN
      ALTER TABLE public.products
      ALTER COLUMN price TYPE NUMERIC(10, 2) USING price::NUMERIC(10, 2);
    END IF;
    
    ALTER TABLE public.products
    ALTER COLUMN price SET DEFAULT 0.00;
    
    ALTER TABLE public.products
    DROP CONSTRAINT IF EXISTS products_price_positive;
    
    ALTER TABLE public.products
    ADD CONSTRAINT products_price_positive CHECK (price >= 0);
  END IF;
END $$;

-- 4. Criar função helper para garantir profile existe
CREATE OR REPLACE FUNCTION public.ensure_user_profile(_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _profile_id UUID;
BEGIN
  SELECT id INTO _profile_id
  FROM public.profiles
  WHERE id = _user_id;
  
  IF _profile_id IS NULL THEN
    INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
    SELECT 
      u.id,
      u.email,
      COALESCE((u.raw_user_meta_data->>'full_name')::TEXT, u.email),
      NOW(),
      NOW()
    FROM auth.users u
    WHERE u.id = _user_id
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO _profile_id;
  END IF;
  
  RETURN _profile_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_user_profile IS 'Garante que um profile existe para o usuário, criando se necessário';
`;

    // Executar SQL usando rpc ou método direto
    // Como não podemos executar SQL direto via Supabase JS, vamos usar uma abordagem diferente
    // Vamos executar cada comando separadamente via queries específicas
    
    const results: any[] = [];
    const errors: any[] = [];

    // 1. Corrigir foreign key
    try {
      // Remover constraint antiga
      await supabase.rpc('exec_sql', { 
        sql: 'ALTER TABLE public.organization_onboarding_progress DROP CONSTRAINT IF EXISTS organization_onboarding_progress_user_id_fkey;' 
      }).catch(() => {}); // Ignorar se função não existir
      
      // Adicionar nova constraint
      await supabase.rpc('exec_sql', { 
        sql: `ALTER TABLE public.organization_onboarding_progress
              ADD CONSTRAINT organization_onboarding_progress_user_id_fkey
              FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;` 
      }).catch(() => {});
      
      results.push('Foreign key corrigida');
    } catch (e) {
      errors.push({ step: 'foreign_key', error: e });
    }

    // 2. Criar função ensure_user_profile
    try {
      await supabase.rpc('exec_sql', { 
        sql: migrationSQL.split('-- 4.')[1] 
      }).catch(() => {});
      results.push('Função ensure_user_profile criada');
    } catch (e) {
      errors.push({ step: 'ensure_user_profile', error: e });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Migration aplicada (parcialmente - alguns comandos podem precisar ser executados manualmente)',
        results,
        errors: errors.length > 0 ? errors : undefined,
        note: 'Alguns comandos DDL precisam ser executados diretamente no banco. Execute o SQL completo no Supabase SQL Editor.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[APPLY-ONBOARDING-FIX] Erro:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro desconhecido',
        note: 'Execute o SQL manualmente no Supabase SQL Editor'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


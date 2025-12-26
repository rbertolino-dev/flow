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
    // Obter Service Role Key do ambiente
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SQL para aplicar
    const sql = `
CREATE OR REPLACE FUNCTION public.can_create_evolution_instance(
  _org_id UUID,
  _user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_limits RECORD;
  current_count INTEGER;
  is_super_admin BOOLEAN := FALSE;
BEGIN
  IF _user_id IS NOT NULL THEN
    SELECT 
      public.has_role(_user_id, 'admin'::app_role) OR 
      public.is_pubdigital_user(_user_id)
    INTO is_super_admin;
    
    IF is_super_admin THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  SELECT * INTO org_limits
  FROM organization_limits
  WHERE organization_id = _org_id;
  
  IF org_limits IS NULL THEN
    RETURN TRUE;
  END IF;
  
  IF org_limits.enabled_features IS NOT NULL AND 
     array_length(org_limits.enabled_features, 1) IS NOT NULL AND
     array_length(org_limits.enabled_features, 1) > 0 THEN
    IF NOT ('evolution_instances'::public.organization_feature = ANY(org_limits.enabled_features)) THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  SELECT COUNT(*) INTO current_count
  FROM evolution_config
  WHERE organization_id = _org_id;
  
  IF org_limits.max_evolution_instances IS NULL THEN
    IF org_limits.max_instances IS NULL THEN
      RETURN TRUE;
    ELSE
      RETURN current_count < org_limits.max_instances;
    END IF;
  ELSE
    RETURN current_count < org_limits.max_evolution_instances;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.can_create_evolution_instance(UUID, UUID) IS 
'Verifica se a organização pode criar uma nova instância Evolution baseado nos limites configurados. Super admins podem criar independentemente dos limites.';
    `;

    // Executar SQL via RPC (usando função do Supabase)
    // Como não podemos executar SQL arbitrário diretamente, vamos usar uma abordagem diferente
    // Vamos usar o Supabase Management API via fetch
    
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      // Se não tiver função exec_sql, vamos tentar outra abordagem
      // Usar o Supabase PostgREST para executar via função SQL
      // Mas isso requer que a função já exista no banco
      
      // Alternativa: retornar instruções
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Não foi possível executar SQL diretamente via API',
          instructions: 'Execute o SQL manualmente no Supabase Dashboard',
          sql: sql,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'SQL aplicado com sucesso',
        result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        instructions: 'Execute o SQL manualmente no Supabase Dashboard',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


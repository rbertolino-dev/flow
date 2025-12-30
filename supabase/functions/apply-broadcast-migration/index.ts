import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Usar service role key para bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Criar função SQL que executa a migration
    const createFunctionSQL = `
CREATE OR REPLACE FUNCTION public.apply_broadcast_migration()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Permitir instance_id NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaigns'
      AND column_name = 'instance_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.broadcast_campaigns
    ALTER COLUMN instance_id DROP NOT NULL;
  END IF;

  -- Adicionar coluna sending_method se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaigns'
      AND column_name = 'sending_method'
  ) THEN
    ALTER TABLE public.broadcast_campaigns
    ADD COLUMN sending_method TEXT DEFAULT 'single';
  END IF;

  RETURN 'Migration aplicada com sucesso';
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'Erro: ' || SQLERRM;
END;
$$;
`;

    // Primeiro, criar a função
    const { error: createError } = await supabase.rpc('exec_sql', { 
      sql_query: createFunctionSQL 
    }).catch(() => {
      // Se RPC não existir, criar função via query direta usando uma abordagem alternativa
      return { error: { message: 'RPC exec_sql não disponível' } };
    });

    if (createError && !createError.message.includes('RPC exec_sql não disponível')) {
      // Tentar criar função usando uma query alternativa
      // Como não podemos executar DDL via REST API, vamos usar uma função SQL existente
      // ou criar via migration manual
    }

    // Executar a função
    const { data: result, error: execError } = await supabase.rpc('apply_broadcast_migration');

    if (execError) {
      // Se função não existe, tentar criar e executar em uma única chamada
      // Usar uma abordagem que funciona via REST API
      
      // Verificar se coluna já permite NULL
      const { data: columnInfo } = await supabase
        .from('information_schema.columns')
        .select('is_nullable')
        .eq('table_schema', 'public')
        .eq('table_name', 'broadcast_campaigns')
        .eq('column_name', 'instance_id')
        .maybeSingle();

      // Verificar se sending_method existe
      const { data: sendingMethodExists } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'broadcast_campaigns')
        .eq('column_name', 'sending_method')
        .maybeSingle();

      if (!sendingMethodExists) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Migration precisa ser aplicada manualmente. A coluna 'sending_method' não existe.",
            sql: `
-- Aplicar esta migration no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

ALTER TABLE public.broadcast_campaigns
ALTER COLUMN instance_id DROP NOT NULL;

ALTER TABLE public.broadcast_campaigns
ADD COLUMN IF NOT EXISTS sending_method TEXT DEFAULT 'single';
            `,
            link: "https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Migration já aplicada ou não necessária",
          columnInfo,
          sendingMethodExists
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

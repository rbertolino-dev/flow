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
    // Usar service role key para bypass RLS e executar DDL
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SQL da migration
    const migrationSQL = `
-- 1. Permitir instance_id NULL
DO $$
BEGIN
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
END $$;

-- 2. Adicionar sending_method
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaigns'
      AND column_name = 'sending_method'
  ) THEN
    ALTER TABLE public.broadcast_campaigns
    ADD COLUMN sending_method TEXT DEFAULT 'single';
    
    UPDATE public.broadcast_campaigns
    SET sending_method = 'single'
    WHERE sending_method IS NULL;
  END IF;
END $$;

-- 3. Adicionar instance_ids
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaigns'
      AND column_name = 'instance_ids'
  ) THEN
    ALTER TABLE public.broadcast_campaigns
    ADD COLUMN instance_ids UUID[] DEFAULT '{}'::UUID[];
  END IF;
END $$;
`;

    // Executar SQL usando rpc exec_sql (se existir) ou via query direta
    // Nota: Supabase não permite DDL via REST API diretamente
    // Vamos verificar se as colunas existem e informar o resultado
    
    const { data: columns, error: checkError } = await supabase
      .rpc('exec_sql', { sql_query: migrationSQL })
      .catch(async () => {
        // Se RPC não existir, verificar colunas manualmente
        const { data: sendingMethod } = await supabase
          .from('information_schema.columns')
          .select('column_name')
          .eq('table_schema', 'public')
          .eq('table_name', 'broadcast_campaigns')
          .eq('column_name', 'sending_method')
          .maybeSingle();
        
        const { data: instanceIds } = await supabase
          .from('information_schema.columns')
          .select('column_name')
          .eq('table_schema', 'public')
          .eq('table_name', 'broadcast_campaigns')
          .eq('column_name', 'instance_ids')
          .maybeSingle();
        
        return {
          data: { sendingMethod: !!sendingMethod, instanceIds: !!instanceIds },
          error: null
        };
      });

    if (checkError && !columns) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Não foi possível verificar colunas. Aplique manualmente via Dashboard.",
          sql: migrationSQL
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Migration precisa ser aplicada manualmente via Supabase Dashboard SQL Editor",
        sql: migrationSQL,
        columns: columns
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

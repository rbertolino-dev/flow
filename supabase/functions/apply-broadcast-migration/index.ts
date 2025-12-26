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

    // SQL da migration
    const migrationSQL = `
-- Permitir instance_id NULL quando campanha usa múltiplas instâncias
DO $$
BEGIN
  -- Verificar se a coluna já permite NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaigns'
      AND column_name = 'instance_id'
      AND is_nullable = 'NO'
  ) THEN
    -- Remover constraint NOT NULL se existir
    ALTER TABLE public.broadcast_campaigns
    ALTER COLUMN instance_id DROP NOT NULL;
    
    COMMENT ON COLUMN public.broadcast_campaigns.instance_id IS 
      'ID da instância (NULL quando campanha usa múltiplas instâncias - rotate ou separate)';
  END IF;
END $$;

-- Adicionar coluna sending_method se não existir
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
    
    COMMENT ON COLUMN public.broadcast_campaigns.sending_method IS 
      'Método de envio: single (uma instância), rotate (rotacionar entre instâncias), separate (disparar separadamente)';
  END IF;
END $$;
`;

    // Executar SQL usando RPC ou query direta
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: migrationSQL });

    if (error) {
      // Se RPC não existir, tentar executar diretamente via query
      // Nota: Supabase não permite executar DDL via REST API diretamente
      // Vamos usar uma abordagem diferente
      
      // Verificar se coluna já permite NULL
      const { data: columnInfo } = await supabase
        .from('information_schema.columns')
        .select('is_nullable')
        .eq('table_schema', 'public')
        .eq('table_name', 'broadcast_campaigns')
        .eq('column_name', 'instance_id')
        .single();

      if (columnInfo && columnInfo.is_nullable === 'NO') {
        // Não podemos alterar via REST API, mas podemos informar que precisa ser feito manualmente
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Migration precisa ser aplicada manualmente via Supabase Dashboard SQL Editor",
            sql: migrationSQL
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar se sending_method existe
      const { data: sendingMethodExists } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'broadcast_campaigns')
        .eq('column_name', 'sending_method')
        .single();

      if (!sendingMethodExists) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Migration precisa ser aplicada manualmente via Supabase Dashboard SQL Editor",
            sql: migrationSQL
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Migration já aplicada ou não necessária" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


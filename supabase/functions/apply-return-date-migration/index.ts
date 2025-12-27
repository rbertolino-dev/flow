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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Criar cliente com Service Role Key (tem acesso total)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SQL para aplicar
    const sql = `
      ALTER TABLE public.leads 
      ADD COLUMN IF NOT EXISTS return_date TIMESTAMP WITH TIME ZONE;

      CREATE INDEX IF NOT EXISTS idx_leads_return_date 
      ON public.leads(return_date) 
      WHERE return_date IS NOT NULL;

      COMMENT ON COLUMN public.leads.return_date IS 'Data de retorno agendada para o lead';
    `;

    // Executar SQL via RPC (se existir função exec_sql)
    // Caso contrário, usar método alternativo
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
      
      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Migration aplicada com sucesso via RPC',
          data,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (rpcError: any) {
      // Se RPC não existir, tentar via query direta (não funciona para DDL)
      // Retornar instruções
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Função exec_sql não disponível',
          instructions: 'Execute via Supabase SQL Editor',
          sql: sql.trim(),
          sql_editor_url: `https://supabase.com/dashboard/project/${supabaseUrl.split('//')[1].split('.')[0]}/sql/new`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
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

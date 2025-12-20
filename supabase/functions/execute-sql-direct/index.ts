import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sql } = await req.json();

    if (!sql) {
      return new Response(
        JSON.stringify({ error: 'SQL não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter connection string do banco
    const dbUrl = Deno.env.get('DATABASE_URL');
    if (!dbUrl) {
      return new Response(
        JSON.stringify({ error: 'DATABASE_URL não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Executar SQL via psql (se disponível) ou retornar instruções
    // Como não podemos executar psql diretamente em Deno, vamos usar uma abordagem diferente
    
    // Usar Supabase Management API se disponível
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Tentar executar via REST API usando PostgREST (limitado)
    // Ou retornar instruções para execução manual
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'SQL preparado para execução',
        instructions: 'Execute via Supabase SQL Editor ou use psql diretamente',
        sql_preview: sql.substring(0, 200) + '...',
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


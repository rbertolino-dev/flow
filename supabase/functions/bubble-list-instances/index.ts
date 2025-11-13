import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BUBBLE_API_KEY = Deno.env.get('BUBBLE_API_KEY');
    const apiKey = req.headers.get('x-api-key');

    // Validar API Key
    if (!apiKey || apiKey !== BUBBLE_API_KEY) {
      console.error('❌ API Key inválida ou ausente');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid API Key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📋 Listando instâncias Evolution...');

    // Criar cliente Supabase com Service Role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar todas as instâncias conectadas
    const { data: instances, error } = await supabase
      .from('evolution_config')
      .select('id, instance_name, is_connected, phone_number, organization_id')
      .eq('is_connected', true)
      .order('instance_name');

    if (error) {
      console.error('❌ Erro ao buscar instâncias:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch instances' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Encontradas ${instances?.length || 0} instâncias`);

    // Formatar resposta
    const formattedInstances = (instances || []).map(inst => ({
      id: inst.id,
      name: inst.instance_name,
      isConnected: inst.is_connected,
      phoneNumber: inst.phone_number || null,
      organizationId: inst.organization_id
    }));

    return new Response(
      JSON.stringify({
        instances: formattedInstances,
        count: formattedInstances.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro ao listar instâncias:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

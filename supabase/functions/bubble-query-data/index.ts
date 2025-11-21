import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autenticado');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    // Buscar organização do usuário
    const { data: orgMembers, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id);

    if (orgError) {
      console.error('Erro ao buscar organização:', orgError);
      throw new Error('Erro ao buscar organização do usuário');
    }

    if (!orgMembers || orgMembers.length === 0) {
      throw new Error('Usuário não pertence a nenhuma organização');
    }

    // Usar a primeira organização encontrada
    const organizationId = orgMembers[0].organization_id;

    // Buscar configuração Bubble
    const { data: bubbleConfig, error: configError } = await supabase
      .from('bubble_configs')
      .select('*')
      .eq('organization_id', organizationId)
      .single();

    if (configError || !bubbleConfig) {
      throw new Error('Configuração Bubble.io não encontrada');
    }

    const { query_type, endpoint, constraints } = await req.json();

    // Verificar cache recente (últimas 24h)
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    const { data: cachedQuery } = await supabase
      .from('bubble_query_history')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('query_type', query_type)
      .eq('query_params', JSON.stringify({ endpoint, constraints }))
      .gte('created_at', oneDayAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Se existe cache recente, retornar do cache
    if (cachedQuery) {
      console.log('✅ Retornando dados do cache');
      return new Response(
        JSON.stringify({
          data: cachedQuery.response_data,
          cached: true,
          cached_at: cachedQuery.created_at,
          message: 'Dados do cache (últimas 24h)'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fazer consulta real ao Bubble
    console.log('🔄 Consultando Bubble.io API...');
    const bubbleUrl = `${bubbleConfig.api_url}/obj/${endpoint}`;
    
    const params = new URLSearchParams();
    if (constraints) {
      params.append('constraints', JSON.stringify(constraints));
    }

    const bubbleResponse = await fetch(`${bubbleUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${bubbleConfig.api_key}`,
        'Content-Type': 'application/json',
      },
    });

    if (!bubbleResponse.ok) {
      throw new Error(`Erro Bubble API: ${bubbleResponse.status}`);
    }

    const bubbleData = await bubbleResponse.json();

    // Salvar no histórico para cache
    await supabase
      .from('bubble_query_history')
      .insert({
        organization_id: organizationId,
        query_type,
        query_params: { endpoint, constraints },
        response_data: bubbleData,
      });

    console.log('✅ Dados consultados e salvos no cache');

    return new Response(
      JSON.stringify({
        data: bubbleData,
        cached: false,
        message: 'Dados consultados do Bubble.io'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

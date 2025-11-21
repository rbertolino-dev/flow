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

    console.log('🔐 Verificando autenticação...');
    
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Header Authorization ausente');
      throw new Error('Não autenticado');
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('📝 Token recebido:', token.substring(0, 20) + '...');

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError) {
      console.error('❌ Erro de autenticação:', authError);
      throw new Error('Erro de autenticação: ' + authError.message);
    }

    if (!user) {
      console.error('❌ Usuário não encontrado');
      throw new Error('Usuário não autenticado');
    }

    console.log('✅ Usuário autenticado:', user.id, user.email);

    // Buscar organização do usuário usando Service Role para bypassar RLS
    console.log('🔍 Buscando organizações do usuário...');
    
    const { data: orgMembers, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id);

    console.log('📊 Resultado da query:', { orgMembers, orgError });

    if (orgError) {
      console.error('❌ Erro ao buscar organização:', orgError);
      throw new Error('Erro ao buscar organização: ' + orgError.message);
    }

    if (!orgMembers || orgMembers.length === 0) {
      console.error('❌ Usuário não pertence a nenhuma organização. User ID:', user.id);
      throw new Error('Usuário não pertence a nenhuma organização. Verifique se está associado a uma organização.');
    }

    const organizationId = orgMembers[0].organization_id;
    console.log('✅ Organização encontrada:', organizationId, 'Role:', orgMembers[0].role);

    // Buscar configuração Bubble
    console.log('🔍 Buscando configuração Bubble para org:', organizationId);
    
    const { data: bubbleConfig, error: configError } = await supabase
      .from('bubble_configs')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    console.log('📊 Config Bubble:', { bubbleConfig, configError });

    if (configError) {
      console.error('❌ Erro ao buscar config Bubble:', configError);
      throw new Error('Erro ao buscar configuração Bubble: ' + configError.message);
    }

    if (!bubbleConfig) {
      console.error('❌ Configuração Bubble não encontrada para org:', organizationId);
      throw new Error('Configure a API Bubble.io primeiro na aba Configuração');
    }

    console.log('✅ Configuração Bubble encontrada');

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
    
    // Construir URL corretamente baseado na estrutura do Bubble
    // Se a api_url já termina com /wf ou /api/1.1/wf, apenas adicionar o endpoint
    let bubbleUrl = bubbleConfig.api_url;
    
    // Remover barra final se existir
    if (bubbleUrl.endsWith('/')) {
      bubbleUrl = bubbleUrl.slice(0, -1);
    }
    
    // Adicionar o endpoint
    bubbleUrl = `${bubbleUrl}/${endpoint}`;
    
    console.log('📍 URL completa:', bubbleUrl);
    
    const params = new URLSearchParams();
    if (constraints && Array.isArray(constraints) && constraints.length > 0) {
      params.append('constraints', JSON.stringify(constraints));
    }

    const fullUrl = params.toString() ? `${bubbleUrl}?${params.toString()}` : bubbleUrl;
    console.log('🌐 Chamando:', fullUrl);

    const bubbleResponse = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${bubbleConfig.api_key}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 Status da resposta:', bubbleResponse.status);

    if (!bubbleResponse.ok) {
      const errorText = await bubbleResponse.text();
      console.error('❌ Resposta de erro:', errorText);
      throw new Error(`Erro Bubble API: ${bubbleResponse.status} - ${errorText}`);
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

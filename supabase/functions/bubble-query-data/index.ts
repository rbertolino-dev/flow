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

    const { query_type, endpoint, constraints, skipCache = false } = await req.json();

    // Verificar cache recente (últimas 24h) - apenas se não skipCache
    if (!skipCache) {
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
    } else {
      console.log('⚡ Modo sem cache ativado - consultando direto');
    }

    // Fazer consulta real ao Bubble
    console.log('🔄 Consultando Bubble.io API...');
    
    // Construir URL corretamente baseado na estrutura do Bubble
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
      
      // Verificar se há filtros de data (aceita vários formatos)
      const hasDateFilter = constraints.some((c: any) => 
        c.constraint_type === 'greater than' || 
        c.constraint_type === 'less than' ||
        c.constraint_type === 'greater_than' ||
        c.constraint_type === 'less_than' ||
        (c.key && (c.key.includes('Created Date') || c.key.includes('data') || c.key.includes('date')))
      );
      
      console.log('🔍 Constraints recebidos:', JSON.stringify(constraints));
      console.log('📅 Tem filtro de data?', hasDateFilter);
      
      if (hasDateFilter) {
        console.log('📅 Filtro de data detectado - buscando todos os registros com paginação');
        
        // Buscar todos os registros usando paginação
        let allResults: any[] = [];
        let cursor = 0;
        let hasMore = true;
        let pageCount = 0;
        
        while (hasMore) {
          pageCount++;
          const pageParams = new URLSearchParams(params);
          if (cursor > 0) {
            pageParams.append('cursor', cursor.toString());
          }
          
          const pageUrl = `${bubbleUrl}?${pageParams.toString()}`;
          console.log(`📄 Buscando página ${pageCount} (cursor: ${cursor})...`);
          
          const pageResponse = await fetch(pageUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${bubbleConfig.api_key}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (!pageResponse.ok) {
            const errorText = await pageResponse.text();
            console.error('❌ Resposta de erro:', errorText);
            throw new Error(`Erro Bubble API: ${pageResponse.status} - ${errorText}`);
          }
          
          const pageData = await pageResponse.json();
          
          if (pageData.response?.results) {
            allResults = allResults.concat(pageData.response.results);
            console.log(`✅ Página ${pageCount}: ${pageData.response.results.length} registros (total: ${allResults.length})`);
          }
          
          // Verificar se há mais páginas
          // O Bubble retorna remaining se houver mais dados
          if (pageData.response?.remaining > 0) {
            cursor = pageData.response.cursor || (cursor + 100);
          } else {
            hasMore = false;
          }
          
          // Segurança: limitar a 50 páginas (5000 registros)
          if (pageCount >= 50) {
            console.log('⚠️ Limite de 50 páginas atingido');
            hasMore = false;
          }
        }
        
        console.log(`✅ Total de ${allResults.length} registros obtidos em ${pageCount} página(s)`);
        
        const bubbleData = {
          response: {
            cursor: 0,
            results: allResults,
            count: allResults.length,
            remaining: 0
          }
        };
        
        // Salvar no histórico para cache - apenas se não skipCache
        if (!skipCache) {
          await supabase
            .from('bubble_query_history')
            .insert({
              organization_id: organizationId,
              query_type,
              query_params: { endpoint, constraints },
              response_data: bubbleData,
            });
          console.log('✅ Dados consultados e salvos no cache');
        } else {
          console.log('⚡ Dados consultados (sem armazenamento)');
        }
        
        return new Response(
          JSON.stringify({
            data: bubbleData,
            cached: false,
            skipCache,
            message: skipCache ? `Dados consultados do Bubble.io - ${allResults.length} registros (sem cache)` : `Dados consultados do Bubble.io - ${allResults.length} registros`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Sem filtro de data, limitar a 100
        params.append('limit', '100');
        console.log('⚠️ Limitando a 100 registros (sem filtro de data)');
      }
    } else {
      // Sem constraints, limitar a 100
      params.append('limit', '100');
      console.log('⚠️ Limitando a 100 registros (sem filtros)');
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

    // Salvar no histórico para cache - apenas se não skipCache
    if (!skipCache) {
      await supabase
        .from('bubble_query_history')
        .insert({
          organization_id: organizationId,
          query_type,
          query_params: { endpoint, constraints },
          response_data: bubbleData,
        });
      console.log('✅ Dados consultados e salvos no cache');
    } else {
      console.log('⚡ Dados consultados (sem armazenamento)');
    }

    return new Response(
      JSON.stringify({
        data: bubbleData,
        cached: false,
        skipCache,
        message: skipCache ? 'Dados consultados do Bubble.io (sem cache)' : 'Dados consultados do Bubble.io'
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

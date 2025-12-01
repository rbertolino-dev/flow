import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Não autenticado');
    }

    const { organizationId, inboxId } = await req.json();

    if (!organizationId || !inboxId) {
      throw new Error('organizationId e inboxId são obrigatórios');
    }

    // Buscar configuração do Chatwoot
    const { data: config, error: configError } = await supabase
      .from('chatwoot_configs')
      .select('*')
      .eq('organization_id', organizationId)
      .single();

    if (configError || !config) {
      throw new Error('Configuração do Chatwoot não encontrada');
    }

    if (!config.enabled) {
      throw new Error('Integração com Chatwoot não está ativada');
    }

    // Primeiro, buscar a primeira página para verificar o formato
    const chatwootUrl = `${config.chatwoot_base_url}/api/v1/accounts/${config.chatwoot_account_id}/conversations?inbox_id=${inboxId}&api_access_token=${encodeURIComponent(config.chatwoot_api_access_token)}`;
    
    console.log('📞 Buscando conversas da inbox:', inboxId);

    const response = await fetch(chatwootUrl, {
      method: 'GET',
      headers: {
        'api_access_token': config.chatwoot_api_access_token,
        'Authorization': `Bearer ${config.chatwoot_api_access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Erro ao buscar conversas: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    
    // Extrair conversas do formato retornado
    let conversations = data?.payload || data?.data?.payload || data?.data || data?.conversations || data || [];
    
    // Garantir que é um array
    if (!Array.isArray(conversations)) {
      conversations = [];
    }

    console.log(`✅ ${conversations.length} conversas encontradas na primeira página`);

    // Se houver mais páginas, buscar todas
    if (conversations.length >= 15) {
      const allConversations = [...conversations];
      let currentPage = 2;
      let hasMore = true;
      const maxPages = 100; // Limite de segurança

      while (hasMore && currentPage <= maxPages) {
        try {
          const pageUrl = `${config.chatwoot_base_url}/api/v1/accounts/${config.chatwoot_account_id}/conversations?inbox_id=${inboxId}&page=${currentPage}&api_access_token=${encodeURIComponent(config.chatwoot_api_access_token)}`;
          
          const pageResponse = await fetch(pageUrl, {
            method: 'GET',
            headers: {
              'api_access_token': config.chatwoot_api_access_token,
              'Authorization': `Bearer ${config.chatwoot_api_access_token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          });

          if (!pageResponse.ok) {
            console.log(`ℹ️ Página ${currentPage} retornou erro ${pageResponse.status}, finalizando busca`);
            hasMore = false;
            break;
          }

          const pageData = await pageResponse.json();
          const pageConversations = pageData?.payload || pageData?.data?.payload || pageData?.data || pageData?.conversations || pageData || [];
          
          if (Array.isArray(pageConversations) && pageConversations.length > 0) {
            allConversations.push(...pageConversations);
            console.log(`✅ Página ${currentPage}: ${pageConversations.length} conversas (Total: ${allConversations.length})`);
            
            // Se retornou menos que 15, não há mais páginas
            if (pageConversations.length < 15) {
              hasMore = false;
            } else {
              currentPage++;
            }
          } else {
            hasMore = false;
          }
        } catch (pageError) {
          console.error(`❌ Erro ao buscar página ${currentPage}:`, pageError);
          hasMore = false;
        }
      }

      console.log(`✅ Total final: ${allConversations.length} conversas`);
      return new Response(JSON.stringify({ 
        conversations: allConversations,
        total: allConversations.length 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Se não há mais páginas, retornar apenas as primeiras
    return new Response(JSON.stringify({ 
      conversations: conversations,
      total: conversations.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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

    // Função para buscar todas as conversas com paginação
    const fetchAllConversations = async () => {
      const allConversations: any[] = [];
      let currentPage = 1;
      let hasMore = true;
      const pageSize = 15;
      let consecutiveErrors = 0;
      const maxConsecutiveErrors = 2;

      while (hasMore && currentPage <= 50) { // Limite de 50 páginas
        try {
          // Formato igual ao usado em chatwoot-list-inboxes que funciona
          const chatwootUrl = `${config.chatwoot_base_url}/api/v1/accounts/${config.chatwoot_account_id}/conversations?inbox_id=${inboxId}&page=${currentPage}&api_access_token=${encodeURIComponent(config.chatwoot_api_access_token)}`;
          
          console.log(`📞 Buscando página ${currentPage} da inbox ${inboxId}`);

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
            console.error(`❌ Erro HTTP ${response.status} ao buscar página ${currentPage}: ${errorData.substring(0, 500)}`);
            consecutiveErrors++;
            
            // Se for erro 404 ou 401, parar completamente
            if (response.status === 404 || response.status === 401) {
              console.error(`❌ Erro crítico ${response.status}, parando busca`);
              break;
            }
            
            // Se muitos erros consecutivos, parar
            if (consecutiveErrors >= maxConsecutiveErrors) {
              console.error(`❌ Muitos erros consecutivos (${consecutiveErrors}), parando busca`);
              break;
            }
            
            // Tentar próxima página mesmo com erro
            currentPage++;
            continue;
          }

          consecutiveErrors = 0; // Reset contador de erros
          const data = await response.json();
          
          // A API do Chatwoot geralmente retorna { payload: [...] }
          let conversations: any[] = [];
          
          // Tentar diferentes formatos de resposta
          if (Array.isArray(data)) {
            conversations = data;
          } else if (data?.payload && Array.isArray(data.payload)) {
            conversations = data.payload;
          } else if (data?.data?.payload && Array.isArray(data.data.payload)) {
            conversations = data.data.payload;
          } else if (data?.data && Array.isArray(data.data)) {
            conversations = data.data;
          } else if (data?.conversations && Array.isArray(data.conversations)) {
            conversations = data.conversations;
          }
          
          console.log(`📋 Página ${currentPage}: formato recebido - isArray: ${Array.isArray(data)}, hasPayload: ${!!data?.payload}, conversas encontradas: ${conversations.length}`);
          
          if (conversations.length > 0) {
            allConversations.push(...conversations);
            console.log(`✅ Página ${currentPage}: ${conversations.length} conversas (Total: ${allConversations.length})`);
            
            // Se retornou menos que o pageSize, não há mais páginas
            hasMore = conversations.length >= pageSize;
            currentPage++;
          } else {
            // Se não retornou conversas, não há mais páginas
            console.log(`ℹ️ Página ${currentPage} sem conversas, finalizando`);
            hasMore = false;
          }
        } catch (pageError) {
          console.error(`❌ Erro ao processar página ${currentPage}:`, pageError);
          consecutiveErrors++;
          
          if (consecutiveErrors >= maxConsecutiveErrors) {
            console.error(`❌ Muitos erros consecutivos (${consecutiveErrors}), parando busca`);
            break;
          }
          
          // Tentar próxima página mesmo com erro
          currentPage++;
        }
      }

      return allConversations;
    };

    // Buscar todas as conversas
    console.log(`🚀 Iniciando busca de conversas para inbox ${inboxId}`);
    const allConversations = await fetchAllConversations();

    console.log(`✅ Total de conversas encontradas: ${allConversations.length}`);

    // Sempre retornar um array, mesmo que vazio
    return new Response(JSON.stringify({ 
      conversations: allConversations,
      total: allConversations.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Retornar array vazio ao invés de erro para não quebrar o frontend
    return new Response(JSON.stringify({ 
      conversations: [],
      total: 0,
      error: message 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

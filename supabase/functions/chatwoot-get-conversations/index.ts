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

    const { organizationId, inboxId, page = 1, perPage = 15 } = await req.json();

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
      const pageSize = 15; // Tamanho padrão da API do Chatwoot

      while (hasMore) {
        // API do Chatwoot usa page e per_page como query params
        const chatwootUrl = `${config.chatwoot_base_url}/api/v1/accounts/${config.chatwoot_account_id}/conversations?inbox_id=${inboxId}&page=${currentPage}&per_page=${pageSize}`;
        
        console.log(`📞 Buscando página ${currentPage} da inbox ${inboxId}`);

        const response = await fetch(chatwootUrl, {
          method: 'GET',
          headers: {
            'api_access_token': config.chatwoot_api_access_token,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error(`❌ Erro ao buscar página ${currentPage}: ${response.status} - ${errorData}`);
          break;
        }

        const data = await response.json();
        
        // A API do Chatwoot pode retornar em diferentes formatos
        let conversations: any[] = [];
        if (Array.isArray(data)) {
          conversations = data;
        } else if (data?.payload && Array.isArray(data.payload)) {
          conversations = data.payload;
        } else if (data?.data && Array.isArray(data.data)) {
          conversations = data.data;
        } else if (data?.conversations && Array.isArray(data.conversations)) {
          conversations = data.conversations;
        }
        
        if (conversations.length > 0) {
          allConversations.push(...conversations);
          console.log(`✅ Página ${currentPage}: ${conversations.length} conversas encontradas (Total: ${allConversations.length})`);
          
          // Se retornou menos que o pageSize, não há mais páginas
          hasMore = conversations.length >= pageSize;
          currentPage++;
        } else {
          // Se não retornou conversas, não há mais páginas
          hasMore = false;
        }

        // Limite de segurança para evitar loops infinitos
        if (currentPage > 100) {
          console.warn('⚠️ Limite de 100 páginas atingido');
          break;
        }
      }

      return allConversations;
    };

    // Buscar todas as conversas
    const allConversations = await fetchAllConversations();

    console.log(`✅ Total de conversas encontradas na inbox ${inboxId}: ${allConversations.length}`);

    return new Response(JSON.stringify({ 
      conversations: allConversations,
      total: allConversations.length 
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

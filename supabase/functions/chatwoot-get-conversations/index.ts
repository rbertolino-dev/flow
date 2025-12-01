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

    // Baseado na documentação oficial do Chatwoot API v1
    // Endpoint: GET /api/v1/accounts/:account_id/conversations
    // Formato de resposta: { payload: [...], meta: { current_page, per_page, total_pages } }
    // Autenticação: header 'api_access_token'

    const allConversations: any[] = [];
    let currentPage = 1;
    let hasMore = true;
    const maxPages = 200; // Limite de segurança

    while (hasMore && currentPage <= maxPages) {
      try {
        // URL seguindo o padrão da função chatwoot-list-inboxes que funciona
        const chatwootUrl = `${config.chatwoot_base_url}/api/v1/accounts/${config.chatwoot_account_id}/conversations?inbox_id=${inboxId}&page=${currentPage}`;
        
        console.log(`📞 Buscando página ${currentPage} da inbox ${inboxId}`);

        // Headers seguindo o padrão da função chatwoot-list-inboxes que funciona
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
          const errorText = await response.text();
          console.error(`❌ Erro HTTP ${response.status} na página ${currentPage}: ${errorText.substring(0, 200)}`);
          
          // Se for erro 401 (não autorizado) ou 404 (não encontrado), parar
          if (response.status === 401 || response.status === 404) {
            console.error(`❌ Erro crítico ${response.status}, parando busca`);
            break;
          }
          
          // Se for a primeira página e der erro, retornar erro
          if (currentPage === 1) {
            throw new Error(`Erro ao buscar conversas: ${response.status} - ${errorText.substring(0, 200)}`);
          }
          
          // Se não for a primeira página, apenas parar a busca
          hasMore = false;
          break;
        }

        // Parse da resposta seguindo o padrão de chatwoot-get-messages que funciona
        const data = await response.json();
        
        // Segundo a documentação do Chatwoot, a resposta vem no formato { payload: [...] }
        // Mas também pode vir como array direto ou { data: [...] }
        let pageConversations: any[] = [];
        
        if (data?.payload && Array.isArray(data.payload)) {
          // Formato oficial da documentação: { payload: [...] }
          pageConversations = data.payload;
        } else if (Array.isArray(data)) {
          // Formato alternativo: array direto
          pageConversations = data;
        } else if (data?.data && Array.isArray(data.data)) {
          // Formato alternativo: { data: [...] }
          pageConversations = data.data;
        }

        console.log(`📋 Página ${currentPage}: ${pageConversations.length} conversas encontradas`);

        if (pageConversations.length > 0) {
          allConversations.push(...pageConversations);
          console.log(`✅ Total acumulado: ${allConversations.length} conversas`);

          // Verificar se há mais páginas usando meta (se disponível na resposta)
          if (data?.meta) {
            const meta = data.meta;
            const currentPageNum = meta.current_page || currentPage;
            const totalPages = meta.total_pages;
            
            if (totalPages && currentPageNum >= totalPages) {
              console.log(`📊 Meta indica que não há mais páginas (${currentPageNum}/${totalPages})`);
              hasMore = false;
            } else {
              currentPage++;
            }
          } else {
            // Se não houver meta, usar heurística: se retornou menos que 15, não há mais
            if (pageConversations.length < 15) {
              console.log(`ℹ️ Menos de 15 conversas retornadas, assumindo que não há mais páginas`);
              hasMore = false;
            } else {
              currentPage++;
            }
          }
        } else {
          // Se não retornou conversas, não há mais páginas
          console.log(`ℹ️ Página ${currentPage} não retornou conversas, finalizando busca`);
          hasMore = false;
        }

      } catch (pageError) {
        console.error(`❌ Erro ao processar página ${currentPage}:`, pageError);
        
        // Se for a primeira página e der erro, retornar o erro
        if (currentPage === 1) {
          throw pageError;
        }
        
        // Se não for a primeira página, apenas parar a busca
        hasMore = false;
      }
    }

    console.log(`✅ Busca finalizada. Total de conversas: ${allConversations.length}`);

    // Retornar no formato esperado pelo frontend (igual ao formato de chatwoot-get-messages)
    return new Response(JSON.stringify({ 
      conversations: allConversations,
      total: allConversations.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Retornar erro com status 400 para que o frontend possa tratar
    return new Response(JSON.stringify({ 
      error: message,
      conversations: [],
      total: 0
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

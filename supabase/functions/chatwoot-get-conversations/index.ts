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

    // Buscar conversas - versão simples, igual ao padrão que funciona
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
    
    // Extrair conversas - seguindo o padrão de chatwoot-get-messages que funciona
    const conversations = data?.payload || data?.data?.payload || data?.data || data?.conversations || data || [];
    
    // Garantir que é um array
    const conversationsList = Array.isArray(conversations) ? conversations : [];

    console.log(`✅ ${conversationsList.length} conversas encontradas`);

    return new Response(JSON.stringify({ 
      conversations: conversationsList,
      total: conversationsList.length 
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

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

    const { organizationId, inboxIdentifier, contactIdentifier, conversationId } = await req.json();

    if (!organizationId || !inboxIdentifier || !contactIdentifier || !conversationId) {
      throw new Error('Parâmetros obrigatórios faltando');
    }

    // Buscar configuração do Chatwoot
    const { data: config, error: configError } = await supabase
      .from('chatwoot_configs')
      .select('*')
      .eq('organization_id', organizationId)
      .single();

    if (configError || !config || !config.enabled) {
      throw new Error('Configuração do Chatwoot inválida');
    }

    // Buscar mensagens da conversa
    const chatwootUrl = `${config.chatwoot_base_url}/public/api/v1/inboxes/${inboxIdentifier}/contacts/${contactIdentifier}/conversations/${conversationId}/messages`;
    
    console.log('📞 Buscando mensagens:', conversationId);

    const response = await fetch(chatwootUrl, {
      method: 'GET',
      headers: {
        'api_access_token': config.chatwoot_api_access_token,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Erro ao buscar mensagens: ${response.status} - ${errorData}`);
    }

    const messages = await response.json();

    return new Response(JSON.stringify({ messages }), {
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

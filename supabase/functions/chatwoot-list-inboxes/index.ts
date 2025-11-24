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

    const { organizationId, baseUrl, accountId, apiToken } = await req.json();

    let chatwootBaseUrl: string;
    let chatwootAccountId: number;
    let chatwootApiToken: string;

    // Se credenciais foram fornecidas diretamente (para teste), use-as
    if (baseUrl && accountId && apiToken) {
      chatwootBaseUrl = baseUrl;
      chatwootAccountId = accountId;
      chatwootApiToken = apiToken;
      console.log('📞 Usando credenciais fornecidas para teste');
    } else {
      // Caso contrário, buscar da configuração salva
      if (!organizationId) {
        throw new Error('organizationId é obrigatório');
      }

      const { data: config, error: configError } = await supabase
        .from('chatwoot_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

      if (configError || !config) {
        throw new Error('Configuração do Chatwoot não encontrada para esta organização');
      }

      if (!config.enabled) {
        throw new Error('Integração com Chatwoot não está ativada para esta organização');
      }

      chatwootBaseUrl = config.chatwoot_base_url;
      chatwootAccountId = config.chatwoot_account_id;
      chatwootApiToken = config.chatwoot_api_access_token;
      console.log('📞 Usando credenciais da configuração salva');
    }

    // Listar inboxes
    const chatwootUrl = `${chatwootBaseUrl}/api/v1/accounts/${chatwootAccountId}/inboxes?api_access_token=${encodeURIComponent(chatwootApiToken)}`;
    
    console.log('📞 Listando inboxes');

    const response = await fetch(chatwootUrl, {
      method: 'GET',
      headers: {
        'api_access_token': chatwootApiToken,
        'Authorization': `Bearer ${chatwootApiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Erro ao listar inboxes: ${response.status} - ${errorData}`);
    }

    const inboxes = await response.json();

    return new Response(JSON.stringify({ inboxes }), {
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

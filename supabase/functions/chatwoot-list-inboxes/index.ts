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

    const { organizationId } = await req.json();

    if (!organizationId) {
      throw new Error('organizationId é obrigatório');
    }

    // Buscar configuração do Chatwoot para esta organização
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

    // Listar inboxes do Chatwoot
    const chatwootUrl = `${config.chatwoot_base_url}/api/v1/accounts/${config.chatwoot_account_id}/inboxes`;
    
    console.log('📞 Listando inboxes:', chatwootUrl);

    const response = await fetch(chatwootUrl, {
      method: 'GET',
      headers: {
        'api_access_token': config.chatwoot_api_access_token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
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

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

    const { organizationId, inboxIdentifier, contactIdentifier, sourceId } = await req.json();

    if (!organizationId || !inboxIdentifier || !contactIdentifier || !sourceId) {
      throw new Error('Campos obrigatórios faltando');
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

    // Criar conversa no Chatwoot
    const chatwootUrl = `${config.chatwoot_base_url}/public/api/v1/inboxes/${inboxIdentifier}/contacts/${contactIdentifier}/conversations`;
    
    console.log('📞 Criando conversa:', { contactIdentifier, sourceId });

    const response = await fetch(chatwootUrl, {
      method: 'POST',
      headers: {
        'api_access_token': config.chatwoot_api_access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_id: sourceId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Erro ao criar conversa: ${response.status} - ${errorData}`);
    }

    const conversationData = await response.json();
    const conversationId = conversationData.id;

    // Configurar custom_attribute com organization_id para facilitar identificação no webhook
    if (conversationId && config.chatwoot_account_id) {
      try {
        const updateUrl = `${config.chatwoot_base_url}/api/v1/accounts/${config.chatwoot_account_id}/conversations/${conversationId}`;
        
        await fetch(updateUrl, {
          method: 'PUT',
          headers: {
            'api_access_token': config.chatwoot_api_access_token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            custom_attributes: {
              organization_id: organizationId,
            },
          }),
        });
        
        console.log(`✅ Custom attribute configurado para conversa ${conversationId}`);
      } catch (attrError) {
        console.warn('⚠️ Não foi possível configurar custom_attribute (não crítico):', attrError);
        // Não falha a requisição se não conseguir configurar o atributo
      }
    }

    return new Response(JSON.stringify({
      conversation_id: conversationId,
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

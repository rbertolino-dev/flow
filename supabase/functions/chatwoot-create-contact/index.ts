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

    const { organizationId, inboxIdentifier, name, phoneNumber } = await req.json();

    if (!organizationId || !inboxIdentifier || !name || !phoneNumber) {
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

    // Criar/recuperar contato no Chatwoot
    const chatwootUrl = `${config.chatwoot_base_url}/public/api/v1/inboxes/${inboxIdentifier}/contacts`;
    
    console.log('📞 Criando contato:', { name, phoneNumber });

    const response = await fetch(chatwootUrl, {
      method: 'POST',
      headers: {
        'api_access_token': config.chatwoot_api_access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        phone_number: phoneNumber,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Erro ao criar contato: ${response.status} - ${errorData}`);
    }

    const contactData = await response.json();

    return new Response(JSON.stringify({
      contact_identifier: contactData.id?.toString(),
      source_id: contactData.contact_inboxes?.[0]?.source_id,
      pubsub_token: contactData.pubsub_token,
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

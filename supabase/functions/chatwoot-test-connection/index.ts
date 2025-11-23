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
    const { baseUrl, accountId, apiToken } = await req.json();

    if (!baseUrl || !accountId || !apiToken) {
      throw new Error('Campos obrigatórios faltando');
    }

    // Testar conexão usando Authorization Bearer (user access token)
    const inboxesUrl = `${baseUrl}/api/v1/accounts/${accountId}/inboxes`;
    
    console.log('🧪 Testando conexão:', {
      url: inboxesUrl,
      accountId,
      tokenLength: apiToken?.length || 0,
      tokenPrefix: apiToken?.substring(0, 10) + '...'
    });

    const response = await fetch(inboxesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 Status da resposta:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Erro completo:', {
        status: response.status,
        statusText: response.statusText,
        body: errorData
      });
      throw new Error(`Falha na conexão: ${response.status} - ${errorData}`);
    }

    const data = await response.json();

    console.log('✅ Conexão bem-sucedida');

    return new Response(JSON.stringify({ 
      success: true, 
      inboxCount: data?.payload?.length || data?.length || 0,
      message: 'Conexão estabelecida com sucesso'
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

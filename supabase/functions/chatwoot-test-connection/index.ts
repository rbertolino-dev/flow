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

    // Testar conexão com o Chatwoot
    const chatwootUrl = `${baseUrl}/api/v1/accounts/${accountId}`;
    
    console.log('🧪 Testando conexão:', chatwootUrl);

    const response = await fetch(chatwootUrl, {
      method: 'GET',
      headers: {
        'api_access_token': apiToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Falha na conexão: ${response.status} - ${errorData}`);
    }

    const accountData = await response.json();

    return new Response(JSON.stringify({ 
      success: true, 
      account: accountData 
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

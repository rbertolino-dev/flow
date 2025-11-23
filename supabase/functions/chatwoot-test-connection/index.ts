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

    // First, get an inbox identifier to test with the Public API
    const inboxesUrl = `${baseUrl}/api/v1/accounts/${accountId}/inboxes`;
    
    console.log('🧪 Testando conexão (listando inboxes):', inboxesUrl);

    const response = await fetch(inboxesUrl, {
      method: 'GET',
      headers: {
        'api_access_token': apiToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Erro na resposta:', errorData);
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

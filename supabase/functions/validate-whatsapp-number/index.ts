import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instanceId, phone } = await req.json();

    if (!instanceId || !phone) {
      return new Response(
        JSON.stringify({ error: 'instanceId e phone são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configuração da Evolution API
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: config, error: configError } = await supabase
      .from('evolution_config')
      .select('api_url, api_key, instance_name')
      .eq('id', instanceId)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: 'Instância não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar número
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    // Chamar Evolution API para validar número
    const evolutionUrl = `${config.api_url}/chat/whatsappNumbers/${config.instance_name}`;
    const evolutionResponse = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.api_key,
      },
      body: JSON.stringify({
        numbers: [formattedPhone]
      }),
    });

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text();
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao validar número',
          details: errorText,
          hasWhatsApp: false
        }),
        { status: evolutionResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await evolutionResponse.json();
    
    // A resposta da Evolution retorna um array com objetos { exists: boolean, jid: string }
    const hasWhatsApp = result && result.length > 0 && result[0]?.exists === true;

    return new Response(
      JSON.stringify({ 
        phone: formattedPhone,
        hasWhatsApp,
        jid: result[0]?.jid || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao validar número WhatsApp:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        hasWhatsApp: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

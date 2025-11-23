import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Usar SERVICE_ROLE_KEY para ignorar RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { instanceId, remoteJid } = await req.json();

    if (!instanceId || !remoteJid) {
      throw new Error('instanceId e remoteJid são obrigatórios');
    }

    // Buscar config da instância
    const { data: config, error: configError } = await supabase
      .from('evolution_config')
      .select('*')
      .eq('id', instanceId)
      .maybeSingle();

    if (configError) throw configError;
    if (!config) throw new Error('Instância não encontrada');

    // Buscar mensagens da Evolution API
    const evolutionUrl = `${config.api_url}/chat/fetchMessages/${config.instance_name}`;
    
    console.log(`📨 Buscando mensagens da Evolution API para ${remoteJid}`);
    
    const response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'apikey': config.api_key || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        remoteJid,
        limit: 50, // Últimas 50 mensagens
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro da Evolution API:', errorText);
      throw new Error(`Evolution API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const messages = result.messages || result || [];
    
    console.log(`✅ ${messages.length} mensagens recuperadas`);

    return new Response(
      JSON.stringify({ messages: Array.isArray(messages) ? messages : [] }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('❌ Erro ao buscar mensagens:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

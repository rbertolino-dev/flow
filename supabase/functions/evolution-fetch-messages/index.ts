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

    const { instanceId, remoteJid, page = 1, limit = 50 } = await req.json();

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

    // Buscar mensagens da Evolution API - endpoint correto é findMessages
    const evolutionUrl = `${config.api_url}/chat/findMessages/${config.instance_name}`;
    
    console.log(`📨 Buscando mensagens da Evolution API para ${remoteJid} (página ${page}, limite ${limit})`);
    
    const response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'apikey': config.api_key || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        where: {
          key: {
            remoteJid: remoteJid
          }
        },
        page: page,
        offset: limit,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro da Evolution API:', errorText);
      throw new Error(`Evolution API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    // Extrair mensagens do resultado (pode estar em diferentes formatos)
    let messages = [];
    if (Array.isArray(result)) {
      messages = result;
    } else if (result.messages?.records) {
      messages = result.messages.records;
    } else if (result.messages && Array.isArray(result.messages)) {
      messages = result.messages;
    } else if (result.records) {
      messages = result.records;
    }
    
    console.log(`✅ ${messages.length} mensagens recuperadas para página ${page}`);

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

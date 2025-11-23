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

    const { instanceId, remoteJid, message, mediaUrl, mediaType } = await req.json();

    if (!instanceId || !remoteJid) {
      throw new Error('instanceId e remoteJid são obrigatórios');
    }

    if (!message && !mediaUrl) {
      throw new Error('Mensagem ou mídia são obrigatórios');
    }

    // Buscar config da instância
    const { data: config, error: configError } = await supabase
      .from('evolution_config')
      .select('*')
      .eq('id', instanceId)
      .maybeSingle();

    if (configError) throw configError;
    if (!config) throw new Error('Instância não encontrada');

    let evolutionUrl: string;
    let payload: any;

    if (mediaUrl) {
      // Enviar mídia
      evolutionUrl = `${config.api_url}/message/sendMedia/${config.instance_name}`;
      payload = {
        number: remoteJid,
        mediatype: mediaType || 'image',
        media: mediaUrl,
        caption: message || '',
      };
    } else {
      // Enviar texto
      evolutionUrl = `${config.api_url}/message/sendText/${config.instance_name}`;
      payload = {
        number: remoteJid,
        text: message,
      };
    }

    console.log(`📤 Enviando mensagem via Evolution API para ${remoteJid}`);
    
    const response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'apikey': config.api_key || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro ao enviar mensagem:', errorText);
      throw new Error(`Falha ao enviar: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    console.log('✅ Mensagem enviada com sucesso');

    // NÃO SALVA NO BANCO - apenas retorna sucesso
    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: result.key?.id,
        message: 'Mensagem enviada (sem armazenamento)'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('❌ Erro ao enviar mensagem:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

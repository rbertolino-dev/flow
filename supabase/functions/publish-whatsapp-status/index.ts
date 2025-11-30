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

    const { instanceId, mediaUrl, mediaType, caption, statusPostId } = await req.json();

    if (!instanceId || !mediaUrl || !mediaType) {
      throw new Error('instanceId, mediaUrl e mediaType são obrigatórios');
    }

    if (!['image', 'video'].includes(mediaType)) {
      throw new Error('mediaType deve ser "image" ou "video"');
    }

    // Buscar config da instância
    const { data: config, error: configError } = await supabase
      .from('evolution_config')
      .select('*')
      .eq('id', instanceId)
      .maybeSingle();

    if (configError) throw configError;
    if (!config) throw new Error('Instância não encontrada');

    if (!config.is_connected) {
      throw new Error('Instância não está conectada');
    }

    // Normalizar URL da API (remover /manager se existir)
    const baseUrl = config.api_url.replace(/\/manager\/?$/, '');

    // Para status do WhatsApp, usamos o endpoint sendStatus específico
    const evolutionUrl = `${baseUrl}/message/sendStatus/${config.instance_name}`;
    
    // Payload para status do WhatsApp
    const payload: any = {
      type: mediaType,
      content: mediaUrl,
      allContacts: true, // Visível para todos os contatos
      statusJidList: [], // Array vazio quando allContacts é true
    };

    // Adicionar caption/legenda se fornecido
    if (caption) {
      payload.caption = caption;
    }

    console.log(`📤 Publicando status via Evolution API na instância ${config.instance_name}`);
    console.log(`📋 Payload:`, JSON.stringify({ ...payload, content: mediaUrl.substring(0, 50) + '...' }));
    
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
      console.error('❌ Erro ao publicar status:', errorText);
      
      // Atualizar status do post se statusPostId foi fornecido
      if (statusPostId) {
        await supabase
          .from('whatsapp_status_posts')
          .update({
            status: 'failed',
            error_message: `HTTP ${response.status}: ${errorText.substring(0, 500)}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', statusPostId);
      }
      
      throw new Error(`Falha ao publicar status: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    console.log('✅ Status publicado com sucesso');

    // Atualizar status do post se statusPostId foi fornecido
    if (statusPostId) {
      await supabase
        .from('whatsapp_status_posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', statusPostId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: result.key?.id || result.messageId,
        message: 'Status publicado com sucesso'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('❌ Erro ao publicar status:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});


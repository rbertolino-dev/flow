import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BUBBLE_API_KEY = Deno.env.get('BUBBLE_API_KEY');
    const apiKey = req.headers.get('x-api-key');

    // Validar API Key
    if (!apiKey || apiKey !== BUBBLE_API_KEY) {
      console.error('❌ API Key inválida ou ausente');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid API Key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phone, instanceId, message, pdfFile, metadata } = await req.json();

    console.log('📥 Requisição recebida do Bubble.io:', {
      phone,
      instanceId,
      hasMessage: !!message,
      hasPdf: !!pdfFile,
      metadata
    });

    // Validar campos obrigatórios
    if (!phone || !instanceId || !pdfFile?.filename || !pdfFile?.data) {
      console.error('❌ Campos obrigatórios ausentes');
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          required: ['phone', 'instanceId', 'pdfFile.filename', 'pdfFile.data']
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase com Service Role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar configuração da instância Evolution
    const { data: evolutionConfig, error: configError } = await supabase
      .from('evolution_config')
      .select('api_url, api_key, organization_id, instance_name')
      .eq('id', instanceId)
      .single();

    if (configError || !evolutionConfig) {
      console.error('❌ Instância não encontrada:', configError);
      return new Response(
        JSON.stringify({ error: 'Evolution instance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Instância encontrada:', evolutionConfig.instance_name);

    // Normalizar telefone
    const normalizedPhone = phone.replace(/\D/g, '');
    const whatsappNumber = normalizedPhone.includes('@') 
      ? normalizedPhone 
      : `${normalizedPhone}@s.whatsapp.net`;

    // Decodificar PDF base64
    const pdfBuffer = Uint8Array.from(atob(pdfFile.data), c => c.charCodeAt(0));
    const pdfBase64 = btoa(String.fromCharCode(...pdfBuffer));

    // Enviar via Evolution API
    const evolutionApiUrl = evolutionConfig.api_url.replace(/\/$/, '');
    const sendMediaUrl = `${evolutionApiUrl}/message/sendMedia/${evolutionConfig.instance_name}`;

    console.log('📤 Enviando PDF via Evolution API...');

    const evolutionPayload = {
      number: whatsappNumber,
      options: {
        delay: 1200,
        presence: 'composing',
      },
      mediaMessage: {
        mediatype: 'document',
        media: pdfBase64,
        fileName: pdfFile.filename,
        caption: message || ''
      }
    };

    const evolutionResponse = await fetch(sendMediaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionConfig.api_key || ''
      },
      body: JSON.stringify(evolutionPayload)
    });

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text();
      console.error('❌ Erro ao enviar via Evolution:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send WhatsApp message',
          details: errorText 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const evolutionResult = await evolutionResponse.json();
    console.log('✅ Mensagem enviada via Evolution:', evolutionResult);

    const messageId = evolutionResult?.key?.id || evolutionResult?.message?.key?.id || crypto.randomUUID();

    // Salvar tracking
    const { error: trackingError } = await supabase
      .from('bubble_message_tracking')
      .insert({
        message_id: messageId,
        phone: normalizedPhone,
        organization_id: evolutionConfig.organization_id,
        status: 'sent',
        metadata: metadata || {}
      });

    if (trackingError) {
      console.error('⚠️ Erro ao salvar tracking (não crítico):', trackingError);
    }

    console.log('✅ Processo completo! Message ID:', messageId);

    // Retornar confirmação para Bubble
    return new Response(
      JSON.stringify({
        success: true,
        messageId: messageId,
        timestamp: new Date().toISOString(),
        phone: normalizedPhone
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro no webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

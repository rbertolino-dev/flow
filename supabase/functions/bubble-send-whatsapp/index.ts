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

    // Parse JSON com tratamento de erros
    let requestBody;
    try {
      const rawBody = await req.text();
      console.log('📥 Body recebido (raw):', rawBody);
      requestBody = JSON.parse(rawBody);
    } catch (parseError: unknown) {
      console.error('❌ Erro ao fazer parse do JSON:', parseError);
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON format',
          details: errorMessage
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phone, instanceId, message, pdfFile, metadata } = requestBody;

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

    console.log('📋 Buscando instância:', instanceId);

    // Buscar configuração da instância Evolution (tenta UUID primeiro, depois nome)
    let evolutionConfig;
    let configError;
    
    // Tentar buscar por UUID
    const { data: configById, error: errorById } = await supabase
      .from('evolution_config')
      .select('api_url, api_key, organization_id, instance_name')
      .eq('id', instanceId)
      .maybeSingle();

    if (configById) {
      evolutionConfig = configById;
      console.log('✅ Instância encontrada por UUID:', evolutionConfig.instance_name);
    } else {
      // Tentar buscar por nome da instância
      const { data: configByName, error: errorByName } = await supabase
        .from('evolution_config')
        .select('api_url, api_key, organization_id, instance_name')
        .eq('instance_name', instanceId)
        .maybeSingle();
      
      evolutionConfig = configByName;
      configError = errorByName;
      
      if (configByName) {
        console.log('✅ Instância encontrada por nome:', configByName.instance_name);
      }
    }

    if (configError || !evolutionConfig) {
      console.error('❌ Instância não encontrada. instanceId recebido:', instanceId);
      return new Response(
        JSON.stringify({ error: 'Evolution instance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar telefone
    const normalizedPhone = phone.replace(/\D/g, '');
    const whatsappNumber = normalizedPhone.includes('@') 
      ? normalizedPhone 
      : `${normalizedPhone}@s.whatsapp.net`;

    // Processar PDF - aceitar URL, data URI ou base64 puro
    let mediaToSend: string;

    if (typeof pdfFile.data === 'string' && (pdfFile.data.startsWith('http://') || pdfFile.data.startsWith('https://') || pdfFile.data.startsWith('data:'))) {
      // URL pública ou Data URI enviada pelo Bubble → enviar como veio
      mediaToSend = pdfFile.data;
      console.log('🧾 PDF recebido como', pdfFile.data.startsWith('data:') ? 'Data URI' : 'URL');
    } else {
      // Base64 puro → prefixar corretamente como Data URI
      const base64 = typeof pdfFile.data === 'string' && pdfFile.data.includes(',')
        ? pdfFile.data.split(',')[1]
        : String(pdfFile.data || '');
      mediaToSend = `data:application/pdf;base64,${base64}`;
      console.log('🧾 PDF recebido como base64 puro (prefixado em Data URI)');
    }

    // Enviar via Evolution API
    const evolutionApiUrl = evolutionConfig.api_url.replace(/\/$/, '');
    const sendMediaUrl = `${evolutionApiUrl}/message/sendMedia/${evolutionConfig.instance_name}`;

    console.log('📤 Enviando PDF via Evolution API...');

    const evolutionPayload = {
      number: whatsappNumber,
      mediatype: 'document',
      mimetype: 'application/pdf',
      media: mediaToSend,
      fileName: pdfFile.filename,
      caption: message || '',
      delay: 1200
    };

    console.log('📦 Payload Evolution (media preview):', {
      ...evolutionPayload,
      media: typeof mediaToSend === 'string' ? mediaToSend.substring(0, 80) + '…' : '[binary]'
    });

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

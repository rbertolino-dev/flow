import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

/**
 * Calcula delay de digitação realista baseado no tamanho da mensagem
 * Valores DOBRADOS para máxima segurança:
 * - Mínimo: 4000ms (4 segundos) - tempo de pensar antes de começar
 * - Máximo: 30000ms (30 segundos) - mensagens muito longas
 * - Velocidade: 3.5 caracteres/segundo (média humana)
 */
function calculateTypingDelay(message: string, messageType: 'text' | 'media' | 'document' = 'text'): number {
  if (!message || message.length === 0) {
    // Mensagens sem texto: tempo mínimo baseado no tipo (DOBRADO)
    if (messageType === 'document') return 5000; // 5s para documentos sem caption
    if (messageType === 'media') return 6000; // 6s para mídia sem caption
    return 4000; // 4s para texto sem mensagem
  }
  
  // Velocidade média de digitação humana: ~200-250 caracteres/minuto
  // Isso dá aproximadamente 3.3-4.2 caracteres por segundo
  const charsPerSecond = 3.5;
  
  // Tempo base (pensar + começar a digitar) - DOBRADO
  let baseDelay: number;
  if (messageType === 'document') {
    baseDelay = 5000; // 5s para documentos (mais complexo)
  } else if (messageType === 'media') {
    baseDelay = 5000; // 5s para mídia
  } else {
    baseDelay = 4000; // 4s para texto
  }
  
  // Tempo de digitação baseado no tamanho da mensagem
  const typingTime = (message.length / charsPerSecond) * 1000; // converter para ms
  
  // Variação aleatória ±25% para parecer mais humano
  const variation = 0.25;
  const randomMultiplier = 1 + (Math.random() * variation * 2 - variation);
  
  const calculatedDelay = baseDelay + (typingTime * randomMultiplier);
  
  // Limites DOBRADOS: mínimo baseado no tipo, máximo 30s (texto/mídia) ou 40s (documentos)
  const maxDelay = messageType === 'document' ? 40000 : 30000; // 40s para documentos, 30s para texto/mídia
  
  return Math.max(baseDelay, Math.min(maxDelay, Math.round(calculatedDelay)));
}

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
      delay: calculateTypingDelay(message || '', 'document')
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

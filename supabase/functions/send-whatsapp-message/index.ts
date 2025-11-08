import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('📨 [send-whatsapp-message] Iniciando requisição...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log('📋 [send-whatsapp-message] Body recebido:', JSON.stringify(body, null, 2));

    const { instanceId, phone, message, leadId, mediaUrl, mediaType } = body;

    if (!instanceId || !phone || !message) {
      console.error('❌ [send-whatsapp-message] Parâmetros faltando:', { instanceId, phone, message });
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios: instanceId, phone, message' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`🔍 [send-whatsapp-message] Buscando configuração da instância ${instanceId}...`);

    // Buscar configuração da instância Evolution
    const { data: config, error: configError } = await supabase
      .from('evolution_config')
      .select('api_url, api_key, instance_name, is_connected, organization_id')
      .eq('id', instanceId)
      .maybeSingle();

    if (configError) {
      console.error('❌ [send-whatsapp-message] Erro ao buscar config:', configError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar configuração', details: configError.message }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!config) {
      console.error('❌ [send-whatsapp-message] Configuração não encontrada para ID:', instanceId);
      return new Response(
        JSON.stringify({ error: 'Instância Evolution não encontrada ou não configurada' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ [send-whatsapp-message] Configuração encontrada:', {
      instance_name: config.instance_name,
      api_url: config.api_url,
      is_connected: config.is_connected,
      has_api_key: !!config.api_key,
      organization_id: config.organization_id
    });

    // Remover verificação de is_connected para permitir envio mesmo se o status estiver desatualizado
    // A Evolution API retornará erro se realmente não estiver conectada

    // Formatar telefone para Evolution API
    let formattedPhone = phone.replace(/\D/g, '');
    
    // Garantir que números brasileiros tenham código do país (55)
    if (!formattedPhone.startsWith('55') && formattedPhone.length >= 10) {
      // Verificar se parece um número brasileiro (DDD válido: 11-99)
      const ddd = parseInt(formattedPhone.substring(0, 2));
      if (ddd >= 11 && ddd <= 99) {
        formattedPhone = '55' + formattedPhone;
        console.log('➕ [send-whatsapp-message] Adicionado código do país 55');
      }
    }
    
    const remoteJid = formattedPhone.includes('@') ? formattedPhone : `${formattedPhone}@s.whatsapp.net`;

    console.log('📱 [send-whatsapp-message] Telefone formatado:', { original: phone, formatted: formattedPhone, remoteJid });

    // Definir endpoint e payload baseado no tipo de mensagem
    const baseUrl = config.api_url.replace(/\/manager\/?$/, '');
    let evolutionUrl: string;
    let payload: any;

    if (mediaUrl) {
      // Enviar mensagem com mídia - campos vão direto no root do payload
      evolutionUrl = `${baseUrl}/message/sendMedia/${config.instance_name}`;
      payload = {
        number: remoteJid,
        mediatype: mediaType || 'image',
        media: mediaUrl,
        caption: message || '',
      };
      console.log('🖼️ [send-whatsapp-message] Enviando mensagem com mídia:', { mediatype: mediaType || 'image', mediaUrl });
    } else {
      // Enviar mensagem de texto simples
      evolutionUrl = `${baseUrl}/message/sendText/${config.instance_name}`;
      payload = {
        number: remoteJid,
        text: message,
      };
    }
    
    console.log('🔗 [send-whatsapp-message] URL da Evolution:', evolutionUrl);
    console.log('📤 [send-whatsapp-message] Enviando payload para Evolution:', JSON.stringify(payload, null, 2));

    const evolutionResponse = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.api_key || '',
      },
      body: JSON.stringify(payload),
    });

    const responseStatus = evolutionResponse.status;
    console.log(`📊 [send-whatsapp-message] Status da Evolution API: ${responseStatus}`);

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text();
      console.error('❌ [send-whatsapp-message] Erro da Evolution API:', {
        status: responseStatus,
        statusText: evolutionResponse.statusText,
        error: errorText
      });
      
      return new Response(
        JSON.stringify({ 
          error: `Evolution API retornou erro: ${responseStatus}`,
          details: errorText,
          url: evolutionUrl
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const evolutionData = await evolutionResponse.json();
    console.log('✅ [send-whatsapp-message] Resposta da Evolution:', JSON.stringify(evolutionData, null, 2));

    // Registrar atividade no lead (se leadId foi fornecido)
    if (leadId) {
      console.log(`💾 [send-whatsapp-message] Registrando atividade para lead ${leadId}...`);
      
      const { error: activityError } = await supabase.from('activities').insert({
        lead_id: leadId,
        type: 'whatsapp',
        content: message,
        user_name: 'Você',
        direction: 'outgoing',
      });

      if (activityError) {
        console.error('⚠️ [send-whatsapp-message] Erro ao registrar atividade:', activityError);
      } else {
        console.log('✅ [send-whatsapp-message] Atividade registrada com sucesso');
      }

      // Atualizar last_contact do lead
      const { error: updateError } = await supabase
        .from('leads')
        .update({ last_contact: new Date().toISOString() })
        .eq('id', leadId);

      if (updateError) {
        console.error('⚠️ [send-whatsapp-message] Erro ao atualizar last_contact:', updateError);
      } else {
        console.log('✅ [send-whatsapp-message] last_contact atualizado');
      }
    }

    console.log('🎉 [send-whatsapp-message] Mensagem enviada com sucesso!');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mensagem enviada com sucesso',
        data: evolutionData 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('💥 [send-whatsapp-message] Erro crítico:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno ao enviar mensagem',
        details: error.message,
        stack: error.stack 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { getTestModeConfig, applyTestMode, shouldSendMessage } from "../_shared/test-mode.ts";

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
    let config: any = null;
    let configError: any = null;
    
    try {
      const result = await supabase
        .from('evolution_config')
        .select('api_url, api_key, instance_name, is_connected, organization_id')
        .eq('id', instanceId)
        .maybeSingle();
      
      config = result.data;
      configError = result.error;
      
      console.log('📊 [send-whatsapp-message] Resultado da busca:', {
        hasConfig: !!config,
        hasError: !!configError,
        errorMessage: configError?.message,
        errorCode: configError?.code,
        errorDetails: configError?.details,
        errorHint: configError?.hint
      });
    } catch (fetchError: any) {
      console.error('💥 [send-whatsapp-message] Erro ao executar query:', {
        message: fetchError.message,
        stack: fetchError.stack,
        name: fetchError.name
      });
      configError = fetchError;
    }

    if (configError) {
      console.error('❌ [send-whatsapp-message] Erro ao buscar config:', {
        message: configError.message,
        code: configError.code,
        details: configError.details,
        hint: configError.hint,
        stack: configError.stack
      });
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao buscar configuração', 
          details: configError.message,
          code: configError.code,
          hint: configError.hint
        }),
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
    
    // Validar campos obrigatórios
    if (!config.api_url || !config.instance_name) {
      console.error('❌ [send-whatsapp-message] Configuração incompleta:', {
        hasApiUrl: !!config.api_url,
        hasInstanceName: !!config.instance_name,
        hasApiKey: !!config.api_key
      });
      return new Response(
        JSON.stringify({ 
          error: 'Configuração da instância incompleta',
          details: 'api_url ou instance_name não encontrados'
        }),
        { 
          status: 500,
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

    // Aplicar modo de teste se ativo
    const testConfig = getTestModeConfig();
    const finalPhone = applyTestMode(formattedPhone, testConfig);
    const finalRemoteJid = finalPhone.includes('@') ? finalPhone : `${finalPhone}@s.whatsapp.net`;

    // Verificar se deve realmente enviar
    if (!shouldSendMessage(testConfig)) {
      console.log('🧪 [send-whatsapp-message] TEST MODE - LOG ONLY: Mensagem não será enviada');
      
      // Mesmo em modo de teste, registrar atividade no banco se leadId foi fornecido
      if (leadId) {
        console.log(`💾 [send-whatsapp-message] Registrando atividade para lead ${leadId} (TEST MODE)...`);
        
        const { error: activityError } = await supabase.from('activities').insert({
          lead_id: leadId,
          type: 'whatsapp',
          content: `[TEST MODE] ${message}`,
          user_name: 'Você',
          direction: 'outgoing',
        });

        if (activityError) {
          console.error('⚠️ [send-whatsapp-message] Erro ao registrar atividade:', activityError);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Mensagem simulada (TEST MODE - LOG ONLY)',
          test_mode: true,
          original_phone: phone,
          would_send_to: finalRemoteJid
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Definir endpoint e payload baseado no tipo de mensagem
    const baseUrl = config.api_url.replace(/\/manager\/?$/, '');
    let evolutionUrl: string;
    let payload: any;

    if (mediaUrl) {
      // Enviar mensagem com mídia - campos vão direto no root do payload
      evolutionUrl = `${baseUrl}/message/sendMedia/${config.instance_name}`;
      payload = {
        number: finalRemoteJid,
        mediatype: mediaType || 'image',
        media: mediaUrl,
        caption: message || '',
      };
      console.log('🖼️ [send-whatsapp-message] Enviando mensagem com mídia:', { 
        mediatype: mediaType || 'image', 
        mediaUrl,
        to: finalRemoteJid,
        test_mode: testConfig.enabled
      });
    } else {
      // Enviar mensagem de texto simples
      evolutionUrl = `${baseUrl}/message/sendText/${config.instance_name}`;
      payload = {
        number: finalRemoteJid,
        text: message,
      };
      console.log('📝 [send-whatsapp-message] Enviando mensagem de texto:', {
        to: finalRemoteJid,
        test_mode: testConfig.enabled
      });
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
      let errorText = '';
      let errorData: any = null;
      
      try {
        errorText = await evolutionResponse.text();
        // Tentar parsear como JSON se possível
        try {
          errorData = JSON.parse(errorText);
        } catch {
          // Não é JSON, usar como texto
        }
      } catch (e) {
        errorText = `Erro ao ler resposta: ${e}`;
      }
      
      console.error('❌ [send-whatsapp-message] Erro da Evolution API:', {
        status: responseStatus,
        statusText: evolutionResponse.statusText,
        error: errorText,
        errorData: errorData,
        url: evolutionUrl,
        instanceName: config.instance_name
      });
      
      // Mensagem de erro mais amigável baseada no tipo de erro
      let userMessage = `Erro ao enviar mensagem (Status ${responseStatus})`;
      let errorDetails = errorText;
      
      if (errorData?.response?.message === 'Connection Closed' || errorText.includes('Connection Closed')) {
        userMessage = 'Instância desconectada ou com problema de conexão';
        errorDetails = 'A instância do WhatsApp pode estar desconectada. Verifique o status da instância em Configurações → WhatsApp.';
        
        // Atualizar status da instância no banco para desconectada
        try {
          console.log(`🔄 [send-whatsapp-message] Atualizando status da instância ${config.instance_name} para desconectada...`);
          await supabase
            .from('evolution_config')
            .update({ 
              is_connected: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', instanceId);
          console.log('✅ [send-whatsapp-message] Status da instância atualizado para desconectada');
        } catch (updateStatusError: any) {
          console.error('⚠️ [send-whatsapp-message] Erro ao atualizar status da instância (não crítico):', {
            message: updateStatusError.message
          });
        }
      } else if (responseStatus === 404) {
        userMessage = 'Instância não encontrada na Evolution API';
        errorDetails = `A instância "${config.instance_name}" não foi encontrada. Verifique se o nome da instância está correto.`;
      } else if (responseStatus === 401 || responseStatus === 403) {
        userMessage = 'Erro de autenticação na Evolution API';
        errorDetails = 'A API Key pode estar incorreta ou expirada. Verifique as configurações da instância.';
      } else if (responseStatus === 500) {
        userMessage = 'Erro interno na Evolution API';
        errorDetails = errorData?.response?.message || errorData?.error || errorText || 'Erro desconhecido na Evolution API';
      }
      
      return new Response(
        JSON.stringify({ 
          error: userMessage,
          details: errorDetails,
          status: responseStatus,
          url: evolutionUrl,
          instanceName: config.instance_name
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Processar resposta da Evolution API com tratamento de erros
    let evolutionData: any = null;
    try {
      const responseText = await evolutionResponse.text();
      console.log('📥 [send-whatsapp-message] Resposta raw da Evolution:', responseText.substring(0, 500));
      
      if (responseText.trim()) {
        try {
          evolutionData = JSON.parse(responseText);
          console.log('✅ [send-whatsapp-message] Resposta da Evolution (JSON):', JSON.stringify(evolutionData, null, 2));
        } catch (parseError: any) {
          console.warn('⚠️ [send-whatsapp-message] Resposta não é JSON válido, usando como texto:', {
            parseError: parseError.message,
            responseText: responseText.substring(0, 200)
          });
          evolutionData = { message: responseText, raw: true };
        }
      } else {
        console.warn('⚠️ [send-whatsapp-message] Resposta vazia da Evolution API');
        evolutionData = { message: 'Resposta vazia', success: true };
      }
    } catch (responseError: any) {
      console.error('❌ [send-whatsapp-message] Erro ao processar resposta da Evolution:', {
        message: responseError.message,
        stack: responseError.stack
      });
      // Continuar mesmo com erro na resposta, pois a mensagem pode ter sido enviada
      evolutionData = { message: 'Erro ao processar resposta', error: responseError.message };
    }

    // Registrar atividade no lead (se leadId foi fornecido)
    // Usar try-catch para não falhar se houver erro ao registrar
    if (leadId) {
      try {
        console.log(`💾 [send-whatsapp-message] Registrando atividade para lead ${leadId}...`);
        
        const { error: activityError } = await supabase.from('activities').insert({
          lead_id: leadId,
          type: 'whatsapp',
          content: message,
          user_name: 'Você',
          direction: 'outgoing',
        });

        if (activityError) {
          console.error('⚠️ [send-whatsapp-message] Erro ao registrar atividade:', {
            message: activityError.message,
            code: activityError.code,
            details: activityError.details,
            hint: activityError.hint
          });
        } else {
          console.log('✅ [send-whatsapp-message] Atividade registrada com sucesso');
        }

        // Atualizar last_contact do lead
        const { error: updateError } = await supabase
          .from('leads')
          .update({ last_contact: new Date().toISOString() })
          .eq('id', leadId);

        if (updateError) {
          console.error('⚠️ [send-whatsapp-message] Erro ao atualizar last_contact:', {
            message: updateError.message,
            code: updateError.code,
            details: updateError.details
          });
        } else {
          console.log('✅ [send-whatsapp-message] last_contact atualizado');
        }
      } catch (dbError: any) {
        console.error('⚠️ [send-whatsapp-message] Erro ao salvar dados no banco (não crítico):', {
          message: dbError.message,
          stack: dbError.stack
        });
        // Não falhar a função por erro ao salvar atividade
      }
    }

    console.log('🎉 [send-whatsapp-message] Mensagem enviada com sucesso!');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mensagem enviada com sucesso',
        data: evolutionData,
        test_mode: testConfig.enabled,
        original_phone: phone,
        sent_to: testConfig.enabled ? finalRemoteJid : phone
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    const errorDetails = {
      message: error?.message || 'Erro desconhecido',
      stack: error?.stack || 'N/A',
      name: error?.name || 'Error',
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      cause: error?.cause
    };
    
    console.error('💥 [send-whatsapp-message] Erro crítico:', JSON.stringify(errorDetails, null, 2));
    
    // Log adicional para debugging
    console.error('💥 [send-whatsapp-message] Tipo do erro:', typeof error);
    console.error('💥 [send-whatsapp-message] Erro completo:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno ao enviar mensagem',
        details: errorDetails.message,
        code: errorDetails.code,
        hint: errorDetails.hint
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
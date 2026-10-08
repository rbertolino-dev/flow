import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { keepSingleChatwootConversationAfterSend } from "../_shared/chatwoot-keep-conversation.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

/**
 * Delay curto para envio único de contrato.
 * Não usa o delay "humano" dobrado de disparos em massa (podia chegar a 40s).
 */
function getContractSendDelayMs(): number {
  // 500–1200ms: suficiente para não parecer spam, sem travar o usuário
  return 500 + Math.floor(Math.random() * 700);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    console.log('🚀 Iniciando send-contract-whatsapp...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    console.log('🔐 Variáveis de ambiente:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      urlLength: supabaseUrl.length,
      keyLength: supabaseKey.length
    });
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Variáveis de ambiente não configuradas:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey
      });
      return new Response(
        JSON.stringify({ 
          error: 'Configuração do servidor incompleta',
          details: 'Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Criando cliente Supabase...');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('✅ Cliente Supabase criado com sucesso');

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: 'Corpo da requisição inválido ou vazio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { contract_id, instance_id } = requestBody;

    if (!contract_id || !instance_id) {
      return new Response(
        JSON.stringify({ error: 'contract_id e instance_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar contrato e instância em paralelo (menos latência)
    console.log('🔍 Buscando contrato e instância em paralelo...');
    const [contractResult, evolutionResult] = await Promise.all([
      supabase
        .from('contracts')
        .select(`
          *,
          lead:leads(id, name, phone, email, company)
        `)
        .eq('id', contract_id)
        .single(),
      supabase
        .from('evolution_config')
        .select('api_url, api_key, instance_name, is_connected, organization_id')
        .eq('id', instance_id)
        .maybeSingle(),
    ]);

    const { data: contract, error: contractError } = contractResult;
    const { data: evolutionConfig, error: configError } = evolutionResult;

    if (contractError || !contract) {
      console.error('❌ Erro ao buscar contrato:', contractError);
      return new Response(
        JSON.stringify({ 
          error: 'Contrato não encontrado',
          details: contractError?.message 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Contrato encontrado:', {
      id: contract.id,
      contract_number: contract.contract_number,
      lead_id: contract.lead_id,
      has_lead: !!contract.lead,
      organization_id: contract.organization_id
    });

    console.log('📱 Instância encontrada:', evolutionConfig ? 'Sim' : 'Não');
    console.log('❌ Erro instância:', configError);

    if (configError || !evolutionConfig || !evolutionConfig.is_connected) {
      return new Response(
        JSON.stringify({ error: 'Instância Evolution não encontrada ou desconectada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se a instância pertence à mesma organização
    if (evolutionConfig.organization_id !== contract.organization_id) {
      return new Response(
        JSON.stringify({ error: 'Instância não pertence à mesma organização do contrato' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar se o lead existe
    console.log('👤 Validando lead:', {
      has_lead: !!contract.lead,
      lead_id: contract.lead_id,
      lead_phone: contract.lead?.phone
    });

    if (!contract.lead || !contract.lead.phone) {
      console.error('❌ Lead não encontrado ou sem telefone:', {
        lead_id: contract.lead_id,
        lead: contract.lead
      });
      return new Response(
        JSON.stringify({ 
          error: 'Lead não encontrado ou sem telefone cadastrado',
          lead_id: contract.lead_id
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar PDF (assinado ou não assinado)
    const pdfUrl = contract.signed_pdf_url || contract.pdf_url;
    console.log('📄 PDF URL:', pdfUrl ? 'Encontrado' : 'Não encontrado');
    
    if (!pdfUrl) {
      console.error('❌ PDF não encontrado no contrato');
      return new Response(
        JSON.stringify({ error: 'PDF do contrato não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gerar token de assinatura se não existir
    let signatureToken = contract.signature_token;
    if (!signatureToken) {
      const tokenBytes = new Uint8Array(16);
      crypto.getRandomValues(tokenBytes);
      signatureToken = Array.from(tokenBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }

    // Construir URL de assinatura
    let frontendUrl = Deno.env.get('FRONTEND_URL');
    
    if (!frontendUrl) {
      frontendUrl = 'https://agilizeflow.com.br';
      console.log('⚠️ FRONTEND_URL não configurado, usando URL padrão:', frontendUrl);
    }
    
    frontendUrl = frontendUrl.replace(/\/$/, '');
    const signUrl = `${frontendUrl}/sign-contract/${contract_id}/${signatureToken}`;
    
    console.log('🔗 URL de assinatura gerada:', signUrl);

    // Normalizar telefone do lead
    const leadPhone = contract.lead.phone || '';
    if (!leadPhone) {
      return new Response(
        JSON.stringify({ error: 'Telefone do lead não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let normalizedPhone = leadPhone.replace(/\D/g, '');
    if (/@lid/i.test(leadPhone)) {
      return new Response(
        JSON.stringify({ error: 'Telefone inválido (@lid). Use o número com DDD.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (leadPhone.includes('@')) {
      normalizedPhone = leadPhone.split('@')[0].replace(/\D/g, '');
    }
    if (!normalizedPhone.startsWith('55') && normalizedPhone.length >= 10 && normalizedPhone.length <= 11) {
      const ddd = parseInt(normalizedPhone.substring(0, 2));
      if (ddd >= 11 && ddd <= 99) normalizedPhone = '55' + normalizedPhone;
    }
    if (!normalizedPhone || normalizedPhone.length < 12 || normalizedPhone.length > 13) {
      return new Response(
        JSON.stringify({ error: 'Telefone do lead inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Só dígitos — evita @lid / segunda conversa no Chatwoot
    const whatsappNumber = normalizedPhone;
    
    console.log('📱 Telefone formatado:', {
      original: leadPhone,
      normalized: normalizedPhone,
      whatsappNumber: whatsappNumber
    });

    // Enviar via Evolution API
    const evolutionApiUrl = evolutionConfig.api_url.replace(/\/$/, '');
    const sendMediaUrl = `${evolutionApiUrl}/message/sendMedia/${evolutionConfig.instance_name}`;

    const leadName = contract.lead.name || 'Cliente';
    let caption: string;
    
    if (contract.whatsapp_message_template) {
      caption = contract.whatsapp_message_template
        .replace(/\{\{nome\}\}/g, leadName)
        .replace(/\{\{numero_contrato\}\}/g, contract.contract_number)
        .replace(/\{\{link_assinatura\}\}/g, signUrl)
        .replace(/\{\{telefone\}\}/g, contract.lead.phone || '')
        .replace(/\{\{email\}\}/g, contract.lead.email || '')
        .replace(/\{\{empresa\}\}/g, contract.lead.company || '');
    } else {
      caption = `📄 Contrato ${contract.contract_number}

Olá ${leadName}, segue o contrato para sua análise.

✍️ Para assinar digitalmente, acesse:
${signUrl}

Ou você pode baixar o PDF anexado e assinar manualmente.`;
    }

    const sendDelayMs = getContractSendDelayMs();
    const evolutionPayload = {
      number: whatsappNumber,
      mediatype: 'document',
      mimetype: 'application/pdf',
      media: pdfUrl,
      fileName: `Contrato_${contract.contract_number}.pdf`,
      caption: caption,
      delay: sendDelayMs,
    };

    console.log('📤 Enviando contrato via Evolution API...', {
      url: sendMediaUrl,
      number: whatsappNumber,
      fileName: evolutionPayload.fileName,
      delayMs: sendDelayMs,
    });

    // Persistência em paralelo com o envio (token + status) — só após sucesso do WhatsApp
    // atualizamos status; token pode ir antes para o link já existir
    const tokenUpdatePromise = !contract.signature_token
      ? supabase
          .from('contracts')
          .update({ signature_token: signatureToken })
          .eq('id', contract_id)
      : Promise.resolve({ error: null });

    const [tokenUpdateResult, evolutionResponse] = await Promise.all([
      tokenUpdatePromise,
      fetch(sendMediaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionConfig.api_key || '',
        },
        body: JSON.stringify(evolutionPayload),
      }),
    ]);

    if (tokenUpdateResult && 'error' in tokenUpdateResult && tokenUpdateResult.error) {
      console.warn('⚠️ Falha ao salvar signature_token (não crítico):', tokenUpdateResult.error);
    }

    console.log('📥 Resposta Evolution:', {
      status: evolutionResponse.status,
      ok: evolutionResponse.ok
    });

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text();
      let errorDetails: any = {};
      
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = { raw: errorText };
      }
      
      console.error('❌ Erro ao enviar via Evolution:', {
        status: evolutionResponse.status,
        statusText: evolutionResponse.statusText,
        error: errorText
      });

      if (evolutionResponse.status === 400 && errorDetails.response?.message) {
        const messages = Array.isArray(errorDetails.response.message) 
          ? errorDetails.response.message 
          : [errorDetails.response.message];
        
        const numberError = messages.find((m: any) => m.exists === false);
        if (numberError) {
          return new Response(
            JSON.stringify({
              error: 'Número do WhatsApp não encontrado',
              details: `O número ${numberError.number || whatsappNumber} não está cadastrado no WhatsApp ou não é válido. Verifique se o número está correto e se o contato possui WhatsApp.`,
              phone: whatsappNumber,
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({
          error: 'Erro ao enviar contrato via WhatsApp',
          details: errorText,
          status: evolutionResponse.status,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const evolutionSendResult = await evolutionResponse.json();
    console.log('✅ Contrato enviado via Evolution:', evolutionSendResult);

    if (contract.organization_id || evolutionConfig.organization_id) {
      await keepSingleChatwootConversationAfterSend({
        supabase,
        organizationId: contract.organization_id || evolutionConfig.organization_id,
        phone: normalizedPhone,
        evolutionPayload: evolutionSendResult,
        evolutionApiUrl: evolutionConfig.api_url,
        evolutionApiKey: evolutionConfig.api_key || '',
        evolutionInstanceName: evolutionConfig.instance_name,
      });
    }

    // Atualizar status + atividade em paralelo após sucesso
    const sentAt = new Date().toISOString();
    const statusUpdatePromise = supabase
      .from('contracts')
      .update({
        status: 'sent',
        sent_at: sentAt,
        signature_token: signatureToken,
      })
      .eq('id', contract_id);

    const activityPromise = contract.lead_id
      ? supabase.from('activities').insert({
          lead_id: contract.lead_id,
          type: 'whatsapp',
          content: `Contrato ${contract.contract_number} enviado via WhatsApp`,
          user_name: 'Sistema',
          direction: 'outgoing',
        })
      : Promise.resolve({ error: null });

    const [statusResult, activityResult] = await Promise.all([
      statusUpdatePromise,
      activityPromise,
    ]);

    if (statusResult.error) {
      console.warn('⚠️ Erro ao atualizar status (envio já feito):', statusResult.error);
    }
    if (activityResult && 'error' in activityResult && activityResult.error) {
      console.warn('⚠️ Erro ao registrar atividade (não crítico):', activityResult.error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Contrato enviado com sucesso',
        contract_id: contract_id,
        delay_ms: sendDelayMs,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro no send-contract-whatsapp:', error);
    console.error('❌ Stack trace:', error.stack);
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        details: error.message || 'Erro desconhecido',
        stack: Deno.env.get('ENVIRONMENT') === 'development' ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


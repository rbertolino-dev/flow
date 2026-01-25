import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

    // Buscar contrato
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select(`
        *,
        lead:leads(id, name, phone),
        organization:organizations(id)
      `)
      .eq('id', contract_id)
      .single();

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

    // Buscar configuração da instância Evolution
    console.log('🔍 Buscando instância Evolution:', instance_id);
    const { data: evolutionConfig, error: configError } = await supabase
      .from('evolution_config')
      .select('api_url, api_key, instance_name, is_connected, organization_id')
      .eq('id', instance_id)
      .maybeSingle();

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
      // Gerar token único (32 caracteres hexadecimais)
      const tokenBytes = new Uint8Array(16);
      crypto.getRandomValues(tokenBytes);
      signatureToken = Array.from(tokenBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      // Salvar token no contrato
      await supabase
        .from('contracts')
        .update({ signature_token: signatureToken })
        .eq('id', contract_id);
    }

    // Construir URL de assinatura
    // Usar URL do frontend configurada ou usar URL padrão
    let frontendUrl = Deno.env.get('FRONTEND_URL');
    
    // Se não foi configurado, usar URL padrão do frontend
    if (!frontendUrl) {
      frontendUrl = 'https://agilizeflow.com.br';
      console.log('⚠️ FRONTEND_URL não configurado, usando URL padrão:', frontendUrl);
    }
    
    // Garantir que não termina com /
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

    // Remover caracteres não numéricos
    let normalizedPhone = leadPhone.replace(/\D/g, '');
    
    // Se já tem @, remover o sufixo antes de normalizar
    if (normalizedPhone.includes('@')) {
      normalizedPhone = normalizedPhone.split('@')[0];
    }
    
    if (!normalizedPhone || normalizedPhone.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Telefone do lead inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Garantir que números brasileiros tenham código do país (55)
    if (!normalizedPhone.startsWith('55') && normalizedPhone.length >= 10) {
      // Verificar se parece um número brasileiro (DDD válido: 11-99)
      const ddd = parseInt(normalizedPhone.substring(0, 2));
      if (ddd >= 11 && ddd <= 99) {
        normalizedPhone = '55' + normalizedPhone;
        console.log('➕ Adicionado código do país 55 ao número');
      }
    }

    const whatsappNumber = `${normalizedPhone}@s.whatsapp.net`;
    
    console.log('📱 Telefone formatado:', {
      original: leadPhone,
      normalized: normalizedPhone,
      whatsappNumber: whatsappNumber
    });

    // Enviar via Evolution API
    const evolutionApiUrl = evolutionConfig.api_url.replace(/\/$/, '');
    const sendMediaUrl = `${evolutionApiUrl}/message/sendMedia/${evolutionConfig.instance_name}`;

    // Mensagem com link de assinatura (usar template personalizado se existir)
    const leadName = contract.lead.name || 'Cliente';
    let caption: string;
    
    if (contract.whatsapp_message_template) {
      // Usar template personalizado e substituir variáveis
      caption = contract.whatsapp_message_template
        .replace(/\{\{nome\}\}/g, leadName)
        .replace(/\{\{numero_contrato\}\}/g, contract.contract_number)
        .replace(/\{\{link_assinatura\}\}/g, signUrl)
        .replace(/\{\{telefone\}\}/g, contract.lead.phone || '')
        .replace(/\{\{email\}\}/g, contract.lead.email || '')
        .replace(/\{\{empresa\}\}/g, contract.lead.company || '');
    } else {
      // Usar template padrão
      caption = `📄 Contrato ${contract.contract_number}

Olá ${leadName}, segue o contrato para sua análise.

✍️ Para assinar digitalmente, acesse:
${signUrl}

Ou você pode baixar o PDF anexado e assinar manualmente.`;
    }

    const evolutionPayload = {
      number: whatsappNumber,
      mediatype: 'document',
      mimetype: 'application/pdf',
      media: pdfUrl,
      fileName: `Contrato_${contract.contract_number}.pdf`,
      caption: caption,
      delay: calculateTypingDelay(caption, 'document'),
    };

    console.log('📤 Enviando contrato via Evolution API...');

    console.log('📤 Enviando para Evolution API:', {
      url: sendMediaUrl,
      number: whatsappNumber,
      fileName: evolutionPayload.fileName
    });

    const evolutionResponse = await fetch(sendMediaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionConfig.api_key || '',
      },
      body: JSON.stringify(evolutionPayload),
    });

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

      // Verificar se é erro de número não existe
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

    const evolutionResult = await evolutionResponse.json();
    console.log('✅ Contrato enviado via Evolution:', evolutionResult);

    // Atualizar status do contrato para 'sent'
    await supabase
      .from('contracts')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', contract_id);

    // Registrar atividade no lead (se lead_id existir)
    if (contract.lead_id) {
      try {
        const activityData: any = {
          lead_id: contract.lead_id,
          type: 'whatsapp',
          content: `Contrato ${contract.contract_number} enviado via WhatsApp`,
          user_name: 'Sistema',
          direction: 'outgoing',
        };
        
        // Adicionar organization_id apenas se a coluna existir (pode não existir em alguns schemas)
        // O Supabase vai ignorar se a coluna não existir
        const { error: activityError } = await supabase.from('activities').insert(activityData);
        
        if (activityError) {
          console.error('⚠️ Erro ao registrar atividade (não crítico):', activityError);
          // Não falhar o envio se a atividade não for registrada
        } else {
          console.log('✅ Atividade registrada com sucesso');
        }
      } catch (err) {
        console.error('⚠️ Erro ao registrar atividade (não crítico):', err);
        // Não falhar o envio se a atividade não for registrada
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Contrato enviado com sucesso',
        contract_id: contract_id,
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


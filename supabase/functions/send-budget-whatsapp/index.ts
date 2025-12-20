import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    console.log('🚀 Iniciando send-budget-whatsapp...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Variáveis de ambiente não configuradas');
      return new Response(
        JSON.stringify({ 
          error: 'Configuração do servidor incompleta',
          details: 'Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

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

    const { budget_id, instance_id } = requestBody;

    if (!budget_id || !instance_id) {
      return new Response(
        JSON.stringify({ error: 'budget_id e instance_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar orçamento
    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .select(`
        *,
        lead:leads(id, name, phone),
        organization:organizations(id)
      `)
      .eq('id', budget_id)
      .single();

    if (budgetError || !budget) {
      console.error('❌ Erro ao buscar orçamento:', budgetError);
      return new Response(
        JSON.stringify({ 
          error: 'Orçamento não encontrado',
          details: budgetError?.message 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Orçamento encontrado:', {
      id: budget.id,
      budget_number: budget.budget_number,
      lead_id: budget.lead_id,
      organization_id: budget.organization_id
    });

    // Buscar configuração da instância Evolution
    console.log('🔍 Buscando instância Evolution:', instance_id);
    const { data: evolutionConfig, error: configError } = await supabase
      .from('evolution_config')
      .select('api_url, api_key, instance_name, is_connected, organization_id')
      .eq('id', instance_id)
      .maybeSingle();

    if (configError || !evolutionConfig || !evolutionConfig.is_connected) {
      return new Response(
        JSON.stringify({ error: 'Instância Evolution não encontrada ou desconectada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se a instância pertence à mesma organização
    if (evolutionConfig.organization_id !== budget.organization_id) {
      return new Response(
        JSON.stringify({ error: 'Instância não pertence à mesma organização do orçamento' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar se o lead existe
    const lead = budget.lead || budget.client_data;
    if (!lead || !lead.phone) {
      console.error('❌ Lead não encontrado ou sem telefone');
      return new Response(
        JSON.stringify({ 
          error: 'Lead não encontrado ou sem telefone cadastrado',
          lead_id: budget.lead_id
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar PDF
    const pdfUrl = budget.pdf_url;
    console.log('📄 PDF URL:', pdfUrl ? 'Encontrado' : 'Não encontrado');
    
    if (!pdfUrl) {
      console.error('❌ PDF não encontrado no orçamento');
      return new Response(
        JSON.stringify({ error: 'PDF do orçamento não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar telefone do lead
    const leadPhone = lead.phone || '';
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

    // Mensagem com informações do orçamento
    const leadName = lead.name || 'Cliente';
    const totalFormatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(budget.total || 0);

    const caption = `📋 Orçamento ${budget.budget_number}

Olá ${leadName}, segue o orçamento para sua análise.

💰 Valor Total: ${totalFormatted}
📅 Validade: ${budget.expires_at ? new Date(budget.expires_at).toLocaleDateString('pt-BR') : 'A definir'}

Para mais informações, entre em contato conosco.`;

    const evolutionPayload = {
      number: whatsappNumber,
      mediatype: 'document',
      mimetype: 'application/pdf',
      media: pdfUrl,
      fileName: `Orcamento_${budget.budget_number}.pdf`,
      caption: caption,
      delay: 1200,
    };

    console.log('📤 Enviando orçamento via Evolution API...');

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
              details: `O número ${numberError.number || whatsappNumber} não está cadastrado no WhatsApp ou não é válido.`,
              phone: whatsappNumber,
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({
          error: 'Erro ao enviar orçamento via WhatsApp',
          details: errorText,
          status: evolutionResponse.status,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const evolutionResult = await evolutionResponse.json();
    console.log('✅ Orçamento enviado via Evolution:', evolutionResult);

    // Registrar atividade no lead (se lead_id existir)
    if (budget.lead_id) {
      try {
        const activityData: any = {
          lead_id: budget.lead_id,
          type: 'whatsapp',
          content: `Orçamento ${budget.budget_number} enviado via WhatsApp`,
          user_name: 'Sistema',
          direction: 'outgoing',
        };
        
        const { error: activityError } = await supabase.from('activities').insert(activityData);
        
        if (activityError) {
          console.error('⚠️ Erro ao registrar atividade (não crítico):', activityError);
        } else {
          console.log('✅ Atividade registrada com sucesso');
        }
      } catch (err) {
        console.error('⚠️ Erro ao registrar atividade (não crítico):', err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Orçamento enviado com sucesso',
        budget_id: budget_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro no send-budget-whatsapp:', error);
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



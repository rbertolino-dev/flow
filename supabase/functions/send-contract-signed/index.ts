import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Log inicial para debug
  console.log('📥 Recebida requisição para send-contract-signed:', {
    method: req.method,
    url: req.url,
    hasAuth: !!req.headers.get('Authorization'),
  });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Variáveis de ambiente não configuradas');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor inválida' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse do body com tratamento de erro
    let requestData;
    try {
      requestData = await req.json();
    } catch (parseError) {
      console.error('❌ Erro ao parsear JSON:', parseError);
      return new Response(
        JSON.stringify({ error: 'Body da requisição inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      contract_id,
      send_method,
      download_link,
      instance_id,
      recipient_phone,
      recipient_email,
    } = requestData;

    console.log('📋 Dados recebidos:', {
      contract_id,
      send_method,
      has_download_link: !!download_link,
      instance_id,
      recipient_phone,
      recipient_email,
    });

    if (!contract_id || !send_method || !download_link) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios: contract_id, send_method, download_link' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se contrato existe e está assinado
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*, lead:leads(*)')
      .eq('id', contract_id)
      .single();

    if (contractError || !contract) {
      return new Response(
        JSON.stringify({ error: 'Contrato não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Removido: não exigir assinaturas antes de enviar
    // O contrato pode ser enviado para o cliente assinar

    // Obter usuário que está enviando
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sent = false;
    let errorMessage = '';

    // Enviar via método selecionado
    if (send_method === 'whatsapp') {
      if (!instance_id || !recipient_phone) {
        return new Response(
          JSON.stringify({ error: 'Para envio via WhatsApp, instance_id e recipient_phone são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar configuração da instância (tabela correta: evolution_configs)
      const { data: config, error: configError } = await supabase
        .from('evolution_configs')
        .select('api_url, api_key, instance_name')
        .eq('id', instance_id)
        .single();

      if (configError || !config) {
        return new Response(
          JSON.stringify({ error: 'Configuração da instância não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Normalizar telefone (remover caracteres não numéricos)
      const normalizedPhone = recipient_phone.replace(/\D/g, '');
      
      // Mensagem padrão
      const message = `Seu contrato assinado está disponível para download:\n\n${download_link}\n\nContrato: ${contract.contract_number}`;

      // Enviar via Evolution API
      const evolutionUrl = `${config.api_url}/message/sendMedia/${config.instance_name}`;
      
      console.log('📤 Enviando para Evolution API:', {
        url: evolutionUrl,
        number: normalizedPhone,
        has_media: !!download_link,
      });

      try {
        const response = await fetch(evolutionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': config.api_key || '',
          },
          body: JSON.stringify({
            number: normalizedPhone,
            mediatype: 'document',
            media: download_link,
            caption: message,
          }),
        });

        console.log('📥 Resposta Evolution API:', {
          status: response.status,
          ok: response.ok,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Erro da Evolution API:', errorText);
          errorMessage = `Erro ao enviar via WhatsApp: ${errorText}`;
        } else {
          const responseData = await response.json().catch(() => ({}));
          console.log('✅ Mensagem enviada com sucesso:', responseData);
          sent = true;
        }
      } catch (evolutionError: any) {
        console.error('❌ Erro ao chamar Evolution API:', evolutionError);
        errorMessage = `Erro ao conectar com Evolution API: ${evolutionError.message || 'Erro desconhecido'}`;
      }
    } else if (send_method === 'email') {
      if (!recipient_email) {
        return new Response(
          JSON.stringify({ error: 'Para envio via Email, recipient_email é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // TODO: Implementar envio de email
      // Por enquanto, apenas simular sucesso
      // Em produção, usar serviço de email (Resend, SendGrid, etc.)
      console.log('Envio de email não implementado ainda');
      errorMessage = 'Envio de email ainda não implementado';
    }

    if (!sent) {
      return new Response(
        JSON.stringify({ error: errorMessage || 'Erro ao enviar contrato' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Salvar log de envio (não falhar se tabela não existir ou houver erro)
    try {
      const { error: logError } = await supabase
        .from('contract_send_logs')
        .insert({
          contract_id,
          sent_via: send_method,
          recipient_phone: send_method === 'whatsapp' ? recipient_phone : null,
          recipient_email: send_method === 'email' ? recipient_email : null,
          download_link,
          sent_by: user.id,
        });

      if (logError) {
        console.error('Erro ao salvar log de envio (não crítico):', logError);
        // Não falhar se log não for salvo - é apenas para auditoria
      }
    } catch (logErr: any) {
      console.error('Erro ao salvar log de envio (não crítico):', logErr);
      // Não falhar se log não for salvo - é apenas para auditoria
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Contrato enviado via ${send_method} com sucesso`,
        download_link,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erro ao enviar contrato:', error);
    console.error('Stack trace:', error.stack);
    
    // Retornar erro mais detalhado para debug
    const errorMessage = error.message || 'Erro interno do servidor';
    const errorDetails = process.env.DENO_ENV === 'development' 
      ? { stack: error.stack, name: error.name }
      : {};
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        ...errorDetails
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


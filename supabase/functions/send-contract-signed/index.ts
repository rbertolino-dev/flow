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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      contract_id,
      send_method,
      download_link,
      instance_id,
      recipient_phone,
      recipient_email,
    } = await req.json();

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

    // Verificar se tem ambas assinaturas
    const { data: signatures } = await supabase
      .from('contract_signatures')
      .select('signer_type')
      .eq('contract_id', contract_id);

    const hasUser = signatures?.some(s => s.signer_type === 'user') || false;
    const hasClient = signatures?.some(s => s.signer_type === 'client') || false;

    if (!hasUser || !hasClient) {
      return new Response(
        JSON.stringify({ error: 'Contrato não está completamente assinado. Ambas as partes precisam assinar.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

      // Buscar configuração da instância
      const { data: config, error: configError } = await supabase
        .from('evolution_config')
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

      if (!response.ok) {
        const errorText = await response.text();
        errorMessage = `Erro ao enviar via WhatsApp: ${errorText}`;
      } else {
        sent = true;
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

    // Salvar log de envio
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
      console.error('Erro ao salvar log de envio:', logError);
      // Não falhar se log não for salvo
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
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


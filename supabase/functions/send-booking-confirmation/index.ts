import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendBookingConfirmationPayload {
  booking_request_id: string;
  send_reminder?: boolean; // Se true, envia lembrete antes do evento
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: SendBookingConfirmationPayload = await req.json();
    const { booking_request_id, send_reminder = false } = payload;

    if (!booking_request_id) {
      return new Response(
        JSON.stringify({ error: 'booking_request_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar solicitação de agendamento
    const { data: bookingRequest, error: requestError } = await supabase
      .from('booking_requests')
      .select(`
        *,
        calendar_events:calendar_event_id (
          html_link,
          summary,
          description
        )
      `)
      .eq('id', booking_request_id)
      .single();

    if (requestError || !bookingRequest) {
      return new Response(
        JSON.stringify({ error: 'Solicitação de agendamento não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se já foi aprovada
    if (bookingRequest.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Solicitação ainda não foi aprovada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se já foi enviada confirmação (se não for lembrete)
    if (!send_reminder && bookingRequest.confirmation_sent_at) {
      return new Response(
        JSON.stringify({ error: 'Confirmação já foi enviada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar template de mensagem
    const templateType = send_reminder ? 'reminder' : 'confirmation';
    const { data: template, error: templateError } = await supabase
      .from('booking_templates')
      .select('template_text')
      .eq('organization_id', bookingRequest.organization_id)
      .eq('template_type', templateType)
      .eq('is_active', true)
      .single();

    // Se não houver template, usar template padrão
    let messageTemplate = template?.template_text || '';
    
    if (!messageTemplate) {
      if (send_reminder) {
        messageTemplate = `Olá {nome}! Lembrete: Você tem uma reunião agendada para {data} às {hora}. {link_meet}`;
      } else {
        messageTemplate = `Olá {nome}! Sua solicitação de agendamento foi aprovada!\n\n📅 Data: {data}\n🕐 Hora: {hora}\n⏱️ Duração: {duracao} minutos\n\n{link_meet}\n\n{observacoes}`;
      }
    }

    // Buscar instância Evolution da organização
    const { data: evolutionConfig, error: evolutionError } = await supabase
      .from('evolution_config')
      .select('id, api_url, api_key, instance_name')
      .eq('organization_id', bookingRequest.organization_id)
      .eq('is_connected', true)
      .limit(1)
      .single();

    if (evolutionError || !evolutionConfig) {
      return new Response(
        JSON.stringify({ error: 'Organização não possui instância Evolution configurada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Formatar data e hora
    const requestedDate = new Date(bookingRequest.requested_datetime);
    const dateStr = requestedDate.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = requestedDate.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Buscar link do Google Meet do evento
    let meetLink = '';
    if (bookingRequest.calendar_events?.html_link) {
      // Tentar extrair link do Meet do HTML link ou buscar do evento
      const { data: calendarEvent, error: eventError } = await supabase
        .from('calendar_events')
        .select('html_link, description')
        .eq('id', bookingRequest.calendar_event_id)
        .single();

      if (calendarEvent?.description) {
        // Procurar link do Meet na descrição
        const meetMatch = calendarEvent.description.match(/https:\/\/meet\.google\.com\/[a-z-]+/i);
        if (meetMatch) {
          meetLink = meetMatch[0];
        }
      }
    }

    // Substituir variáveis no template
    let message = messageTemplate
      .replace(/{nome}/g, bookingRequest.client_name)
      .replace(/{data}/g, dateStr)
      .replace(/{hora}/g, timeStr)
      .replace(/{duracao}/g, String(bookingRequest.duration_minutes || 60))
      .replace(/{link_meet}/g, meetLink || '')
      .replace(/{observacoes}/g, bookingRequest.client_notes || '');

    // Normalizar telefone (remover caracteres não numéricos, exceto +)
    const phone = bookingRequest.client_phone.replace(/[^\d+]/g, '');
    
    // Se não começar com +, adicionar código do Brasil (55)
    const normalizedPhone = phone.startsWith('+') ? phone : `55${phone}`;

    // Enviar mensagem via Evolution API
    const evolutionUrl = `${evolutionConfig.api_url}/message/sendText/${evolutionConfig.instance_name}`;
    
    const evolutionResponse = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionConfig.api_key,
      },
      body: JSON.stringify({
        number: normalizedPhone,
        text: message,
      }),
    });

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text();
      console.error('Erro ao enviar mensagem:', errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao enviar mensagem WhatsApp' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar confirmação enviada
    if (!send_reminder) {
      await supabase
        .from('booking_requests')
        .update({
          confirmation_sent_at: new Date().toISOString(),
        })
        .eq('id', booking_request_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: send_reminder ? 'Lembrete enviado com sucesso' : 'Confirmação enviada com sucesso',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


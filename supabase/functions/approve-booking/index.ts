import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { toZonedTime, fromZonedTime } from "https://esm.sh/date-fns-tz@3.1.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface ApproveBookingPayload {
  booking_request_id: string;
  action: 'approve' | 'reject';
  rejection_reason?: string;
  add_google_meet?: boolean;
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação necessário' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: ApproveBookingPayload = await req.json();
    const { booking_request_id, action, rejection_reason, add_google_meet = false } = payload;

    if (!booking_request_id || !action || !['approve', 'reject'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'booking_request_id e action (approve/reject) são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Criar cliente com service role para operações no banco
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Extrair token do header e validar usuário
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('Erro ao validar usuário:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Usuário autenticado:', user.id);

    // Buscar solicitação de agendamento
    console.log('Buscando booking request:', booking_request_id);
    const { data: bookingRequest, error: requestError } = await supabase
      .from('booking_requests')
      .select('*, organization_id, user_id, google_calendar_config_id, requested_datetime, duration_minutes, client_name, client_email, client_phone, client_notes, status')
      .eq('id', booking_request_id)
      .single();

    if (requestError) {
      console.error('Erro ao buscar booking request:', requestError);
      return new Response(
        JSON.stringify({ error: 'Solicitação de agendamento não encontrada', details: requestError.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!bookingRequest) {
      console.error('Booking request não encontrado');
      return new Response(
        JSON.stringify({ error: 'Solicitação de agendamento não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Booking request encontrado:', bookingRequest.id, 'Status:', bookingRequest.status);

    // Verificar se usuário pertence à organização
    console.log('Verificando membro da organização:', bookingRequest.organization_id);
    const { data: member, error: memberError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', bookingRequest.organization_id)
      .eq('user_id', user.id)
      .single();

    if (memberError) {
      console.error('Erro ao verificar membro:', memberError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar permissões', details: memberError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!member) {
      console.error('Usuário não é membro da organização');
      return new Response(
        JSON.stringify({ error: 'Você não tem permissão para aprovar esta solicitação' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Membro verificado, role:', member.role);

    if (bookingRequest.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: `Esta solicitação já foi ${bookingRequest.status === 'approved' ? 'aprovada' : 'rejeitada'}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'reject') {
      // Rejeitar solicitação
      const { error: updateError } = await supabase
        .from('booking_requests')
        .update({
          status: 'rejected',
          rejection_reason: rejection_reason || null,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', booking_request_id);

      if (updateError) {
        console.error('Erro ao rejeitar:', updateError);
        return new Response(
          JSON.stringify({ error: 'Erro ao rejeitar solicitação' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Solicitação rejeitada com sucesso',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Aprovar solicitação
    console.log('Aprovando solicitação...');
    if (!bookingRequest.google_calendar_config_id) {
      console.error('google_calendar_config_id não encontrado no booking request');
      return new Response(
        JSON.stringify({ error: 'Organização não possui configuração do Google Calendar' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configuração do Google Calendar
    console.log('Buscando configuração do Google Calendar:', bookingRequest.google_calendar_config_id);
    const { data: calendarConfig, error: configError } = await supabase
      .from('google_calendar_configs')
      .select('*')
      .eq('id', bookingRequest.google_calendar_config_id)
      .single();

    if (configError) {
      console.error('Erro ao buscar calendar config:', configError);
      return new Response(
        JSON.stringify({ error: 'Configuração do Google Calendar não encontrada', details: configError.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!calendarConfig) {
      console.error('Calendar config não encontrado');
      return new Response(
        JSON.stringify({ error: 'Configuração do Google Calendar não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Calendar config encontrado:', calendarConfig.id);

    // Obter access token do Google
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: calendarConfig.client_id,
        client_secret: calendarConfig.client_secret,
        refresh_token: calendarConfig.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Erro ao obter token:', await tokenResponse.text());
      return new Response(
        JSON.stringify({ error: 'Erro ao autenticar com Google Calendar' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { access_token } = await tokenResponse.json();

    // Criar evento no Google Calendar
    const startDateTime = new Date(bookingRequest.requested_datetime);
    const endDateTime = new Date(startDateTime.getTime() + (bookingRequest.duration_minutes || 60) * 60 * 1000);

    const event: any = {
      summary: `Reunião com ${bookingRequest.client_name}`,
      description: bookingRequest.client_notes || '',
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
    };

    // Adicionar Google Meet se solicitado
    if (add_google_meet) {
      event.conferenceData = {
        createRequest: {
          requestId: `meet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      };
    }

    // Adicionar cliente como convidado se tiver email
    if (bookingRequest.client_email) {
      event.attendees = [{
        email: bookingRequest.client_email,
        displayName: bookingRequest.client_name,
      }];
    }

    const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarConfig.calendar_id)}/events${add_google_meet ? '?conferenceDataVersion=1' : ''}`;

    const calendarResponse = await fetch(calendarUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text();
      console.error('Erro ao criar evento:', errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar evento no Google Calendar' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const eventData = await calendarResponse.json();
    const meetLink = eventData.conferenceData?.entryPoints?.[0]?.uri || eventData.hangoutLink || null;

    // Salvar evento localmente
    const { data: calendarEvent, error: eventError } = await supabase
      .from('calendar_events')
      .upsert({
        organization_id: bookingRequest.organization_id,
        google_calendar_config_id: bookingRequest.google_calendar_config_id,
        google_event_id: eventData.id,
        summary: eventData.summary || event.summary,
        description: eventData.description || event.description || null,
        start_datetime: startDateTime.toISOString(),
        end_datetime: endDateTime.toISOString(),
        location: eventData.location || null,
        html_link: eventData.htmlLink || null,
        organizer_user_id: bookingRequest.user_id,
        booked_by_user_id: bookingRequest.user_id,
      }, {
        onConflict: 'google_calendar_config_id,google_event_id',
      })
      .select()
      .single();

    // Atualizar solicitação como aprovada
    const { error: updateError } = await supabase
      .from('booking_requests')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        google_event_id: eventData.id,
        calendar_event_id: calendarEvent?.id || null,
      })
      .eq('id', booking_request_id);

    if (updateError) {
      console.error('Erro ao atualizar solicitação:', updateError);
    }

    // Chamar função para enviar confirmação WhatsApp
    try {
      await supabase.functions.invoke('send-booking-confirmation', {
        body: {
          booking_request_id: booking_request_id,
        },
      });
    } catch (error) {
      console.error('Erro ao enviar confirmação (não crítico):', error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Solicitação aprovada e evento criado no Google Calendar',
        google_event_id: eventData.id,
        meet_link: meetLink,
        calendar_event: calendarEvent,
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


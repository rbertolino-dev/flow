import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { fromZonedTime } from "https://esm.sh/date-fns-tz@0.1.2";

interface UpdateEventPayload {
  google_calendar_config_id: string;
  google_event_id: string;
  summary?: string;
  startDateTime?: string;
  endDateTime?: string;
  durationMinutes?: number;
  description?: string;
  location?: string;
  colorId?: string;
  stageId?: string;
  addGoogleMeet?: boolean;
}

serve(async (req) => {
  // CORS headers dinâmicos
  const origin = req.headers.get('Origin') || '*';
  const requestHeaders = req.headers.get('Access-Control-Request-Headers') || 'authorization, x-client-info, apikey, content-type';
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': requestHeaders,
    'Access-Control-Max-Age': '86400',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: {
        ...corsHeaders,
        'Content-Length': '0',
      }
    });
  }

  try {
    let payload: UpdateEventPayload;
    try {
      payload = await req.json() as UpdateEventPayload;
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Payload JSON inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { 
      google_calendar_config_id,
      google_event_id,
      summary, 
      startDateTime,
      endDateTime,
      durationMinutes,
      description,
      location,
      colorId,
      stageId,
      addGoogleMeet = false
    } = payload;

    if (!google_calendar_config_id || !google_event_id) {
      return new Response(
        JSON.stringify({ error: 'google_calendar_config_id e google_event_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configuração
    const { data: config, error: configError } = await supabase
      .from('google_calendar_configs')
      .select('*')
      .eq('id', google_calendar_config_id)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: 'Configuração do Google Calendar não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.client_id,
        client_secret: config.client_secret,
        refresh_token: config.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Erro ao obter access token:', errorText);
      return new Response(
        JSON.stringify({ error: 'Falha na autenticação com Google' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Buscar evento atual do Google Calendar
    const getEventUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendar_id)}/events/${encodeURIComponent(google_event_id)}`;
    const getEventResponse = await fetch(getEventUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!getEventResponse.ok) {
      const errorText = await getEventResponse.text();
      console.error('Erro ao buscar evento:', errorText);
      return new Response(
        JSON.stringify({ error: 'Evento não encontrado no Google Calendar' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existingEvent = await getEventResponse.json();

    // Preparar atualizações
    const eventUpdate: any = {};

    if (summary !== undefined) eventUpdate.summary = summary;
    if (description !== undefined) eventUpdate.description = description || '';
    if (location !== undefined) eventUpdate.location = location || null;
    if (colorId !== undefined) eventUpdate.colorId = colorId || null;

    // Atualizar data/hora se fornecida
    if (startDateTime) {
      // Interpretar startDateTime como hora de São Paulo e converter para UTC
      // Formato esperado: "YYYY-MM-DDTHH:mm:ss" (sem timezone, assumindo São Paulo)
      const [datePart, timePart] = startDateTime.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes, seconds = 0] = timePart.split(':').map(Number);
      
      // Criar data local assumindo que é em São Paulo
      const saoPauloStartDate = new Date(year, month - 1, day, hours, minutes, seconds || 0);
      const utcStartDate = fromZonedTime(saoPauloStartDate, 'America/Sao_Paulo');
      
      let utcEndDate: Date;
      if (endDateTime) {
        const [endDatePart, endTimePart] = endDateTime.split('T');
        const [endYear, endMonth, endDay] = endDatePart.split('-').map(Number);
        const [endHours, endMinutes, endSeconds = 0] = endTimePart.split(':').map(Number);
        const saoPauloEndDate = new Date(endYear, endMonth - 1, endDay, endHours, endMinutes, endSeconds || 0);
        utcEndDate = fromZonedTime(saoPauloEndDate, 'America/Sao_Paulo');
      } else if (durationMinutes) {
        utcEndDate = new Date(utcStartDate.getTime() + durationMinutes * 60000);
      } else {
        const existingEnd = existingEvent.end?.dateTime || existingEvent.end?.date;
        utcEndDate = new Date(existingEnd);
      }

      eventUpdate.start = {
        dateTime: utcStartDate.toISOString(),
        timeZone: 'America/Sao_Paulo',
      };
      eventUpdate.end = {
        dateTime: utcEndDate.toISOString(),
        timeZone: 'America/Sao_Paulo',
      };
    }

    // Adicionar Google Meet se solicitado e não existir
    if (addGoogleMeet && !existingEvent.conferenceData) {
      eventUpdate.conferenceData = {
        createRequest: {
          requestId: `meet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      };
    }

    // Preparar query params
    const queryParams = new URLSearchParams();
    if (addGoogleMeet && !existingEvent.conferenceData) {
      queryParams.append('conferenceDataVersion', '1');
    }

    // Atualizar evento no Google Calendar
    const updateUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendar_id)}/events/${encodeURIComponent(google_event_id)}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const updateResponse = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventUpdate),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('Erro ao atualizar evento:', errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar evento no Google Calendar' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updatedEvent = await updateResponse.json();

    // Atualizar cache local
    const eventStart = updatedEvent.start?.dateTime || updatedEvent.start?.date;
    const eventEnd = updatedEvent.end?.dateTime || updatedEvent.end?.date;

    if (eventStart && eventEnd) {
      await supabase
        .from('calendar_events')
        .update({
          summary: updatedEvent.summary || summary,
          description: updatedEvent.description || description || null,
          start_datetime: new Date(eventStart).toISOString(),
          end_datetime: new Date(eventEnd).toISOString(),
          location: updatedEvent.location || location || null,
          html_link: updatedEvent.htmlLink || null,
          stage_id: stageId !== undefined ? (stageId || null) : undefined,
        })
        .eq('google_calendar_config_id', google_calendar_config_id)
        .eq('google_event_id', google_event_id);
    }

    const meetLink = updatedEvent.conferenceData?.entryPoints?.[0]?.uri || 
                     updatedEvent.hangoutLink || 
                     null;

    return new Response(
      JSON.stringify({ 
        success: true, 
        eventId: updatedEvent.id,
        htmlLink: updatedEvent.htmlLink,
        hangoutLink: meetLink,
        conferenceData: updatedEvent.conferenceData
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


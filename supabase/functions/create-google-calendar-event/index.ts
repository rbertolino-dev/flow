import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { fromZonedTime } from "https://esm.sh/date-fns-tz@0.1.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateEventPayload {
  google_calendar_config_id: string;
  summary: string;
  startDateTime: string;
  durationMinutes?: number;
  description?: string;
  location?: string;
  colorId?: string;
  stageId?: string;
  addGoogleMeet?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      google_calendar_config_id,
      summary, 
      startDateTime, 
      durationMinutes = 60, 
      description,
      location,
      colorId,
      stageId,
      addGoogleMeet = false
    } = await req.json() as CreateEventPayload;

    // Validar parâmetros
    if (!google_calendar_config_id || !summary || !startDateTime) {
      return new Response(
        JSON.stringify({ error: 'google_calendar_config_id, summary e startDateTime são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configuração do Google Calendar
    const { data: config, error: configError } = await supabase
      .from('google_calendar_configs')
      .select('*')
      .eq('id', google_calendar_config_id)
      .single();

    if (configError || !config) {
      console.error('Erro ao buscar configuração:', configError);
      return new Response(
        JSON.stringify({ error: 'Configuração do Google Calendar não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config.is_active) {
      return new Response(
        JSON.stringify({ error: 'Configuração do Google Calendar está inativa' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter access token usando refresh token
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
        JSON.stringify({ error: 'Falha na autenticação com Google. Verifique as credenciais.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Interpretar startDateTime como hora de São Paulo e converter para UTC
    // Formato esperado: "YYYY-MM-DDTHH:mm:ss" (sem timezone, assumindo São Paulo)
    const [datePart, timePart] = startDateTime.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds = 0] = timePart.split(':').map(Number);
    
    // Criar data local assumindo que é em São Paulo
    // fromZonedTime converte uma data/hora de um timezone específico para UTC
    const saoPauloDate = new Date(year, month - 1, day, hours, minutes, seconds || 0);
    const utcStartDate = fromZonedTime(saoPauloDate, 'America/Sao_Paulo');
    
    // Calcular data de término
    const utcEndDate = new Date(utcStartDate.getTime() + durationMinutes * 60000);

    // Criar evento no Google Calendar
    // O Google Calendar espera ISO string UTC quando especificamos timeZone
    const event: any = {
      summary,
      description: description || '',
      start: {
        dateTime: utcStartDate.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: utcEndDate.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
    };

    if (location) {
      event.location = location;
    }

    if (colorId) {
      event.colorId = colorId;
    }

    // Adicionar Google Meet se solicitado
    if (addGoogleMeet) {
      event.conferenceData = {
        createRequest: {
          requestId: `meet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      };
    }

    // Preparar query params para Google Meet
    const queryParams = new URLSearchParams();
    if (addGoogleMeet) {
      queryParams.append('conferenceDataVersion', '1');
    }

    const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendar_id)}/events${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    const calendarResponse = await fetch(calendarUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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
    console.log('Evento criado:', eventData.id);

    const eventStart = eventData.start?.dateTime || eventData.start?.date || utcStartDate.toISOString();
    const eventEnd = eventData.end?.dateTime || eventData.end?.date || utcEndDate.toISOString();

    // Atualizar cache local na tabela calendar_events
    const { error: upsertError } = await supabase
      .from('calendar_events')
      .upsert(
        {
          organization_id: config.organization_id,
          google_calendar_config_id: config.id,
          google_event_id: eventData.id,
          summary: eventData.summary || summary,
          description: eventData.description || description || null,
          start_datetime: new Date(eventStart).toISOString(),
          end_datetime: new Date(eventEnd).toISOString(),
          location: eventData.location || location || null,
          html_link: eventData.htmlLink || null,
          stage_id: stageId || null,
        },
        {
          onConflict: 'google_calendar_config_id,google_event_id',
        }
      );

    if (upsertError) {
      console.error('Erro ao salvar evento local:', upsertError);
    }

    // Extrair link do Google Meet se disponível
    const meetLink = eventData.conferenceData?.entryPoints?.[0]?.uri || 
                     eventData.hangoutLink || 
                     null;

    return new Response(
      JSON.stringify({ 
        success: true, 
        eventId: eventData.id,
        htmlLink: eventData.htmlLink,
        hangoutLink: meetLink,
        conferenceData: eventData.conferenceData
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

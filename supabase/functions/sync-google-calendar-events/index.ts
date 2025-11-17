import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncEventsPayload {
  google_calendar_config_id: string;
  daysBack?: number; // Quantos dias para trás buscar (padrão: 30)
  daysForward?: number; // Quantos dias para frente buscar (padrão: 90)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { google_calendar_config_id, daysBack = 30, daysForward = 90 } = await req.json() as SyncEventsPayload;

    if (!google_calendar_config_id) {
      return new Response(
        JSON.stringify({ error: 'google_calendar_config_id é obrigatório' }),
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

    // Calcular período de busca
    const now = new Date();
    const timeMin = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(now.getTime() + daysForward * 24 * 60 * 60 * 1000).toISOString();

    // Buscar eventos do Google Calendar
    const eventsUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendar_id)}/events`);
    eventsUrl.searchParams.set('timeMin', timeMin);
    eventsUrl.searchParams.set('timeMax', timeMax);
    eventsUrl.searchParams.set('maxResults', '2500');
    eventsUrl.searchParams.set('singleEvents', 'true');
    eventsUrl.searchParams.set('orderBy', 'startTime');

    const eventsResponse = await fetch(eventsUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error('Erro ao buscar eventos:', errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar eventos do Google Calendar' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const eventsData = await eventsResponse.json();
    const events = eventsData.items || [];

    // Processar e salvar eventos na tabela
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (const event of events) {
      try {
        // Ignorar eventos cancelados
        if (event.status === 'cancelled') {
          continue;
        }

        const startDateTime = event.start?.dateTime || event.start?.date;
        const endDateTime = event.end?.dateTime || event.end?.date;

        if (!startDateTime || !endDateTime) {
          continue;
        }

        const eventData = {
          google_calendar_config_id: config.id,
          organization_id: config.organization_id,
          google_event_id: event.id,
          summary: event.summary || '',
          description: event.description || '',
          start_datetime: startDateTime,
          end_datetime: endDateTime,
          location: event.location || null,
          html_link: event.htmlLink || null,
        };

        // Tentar inserir ou atualizar (usando ON CONFLICT)
        const { error: upsertError } = await supabase
          .from('calendar_events')
          .upsert(eventData, {
            onConflict: 'google_calendar_config_id,google_event_id',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error('Erro ao salvar evento:', upsertError);
          errors++;
        } else {
          // Verificar se foi inserção ou atualização
          const { data: existing } = await supabase
            .from('calendar_events')
            .select('id')
            .eq('google_calendar_config_id', config.id)
            .eq('google_event_id', event.id)
            .single();

          if (existing) {
            updated++;
          } else {
            inserted++;
          }
        }
      } catch (error) {
        console.error('Erro ao processar evento:', error);
        errors++;
      }
    }

    // Atualizar last_sync_at na configuração
    await supabase
      .from('google_calendar_configs')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', config.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        events_found: events.length,
        inserted,
        updated,
        errors,
        last_sync_at: new Date().toISOString()
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


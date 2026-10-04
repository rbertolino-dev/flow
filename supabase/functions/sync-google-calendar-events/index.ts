import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { zonedTimeToUtc } from "../_shared/timezone.ts";

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

    // Validar credenciais obrigatórias
    if (!config.client_id || !config.client_secret || !config.refresh_token) {
      console.error('Credenciais incompletas:', {
        has_client_id: !!config.client_id,
        has_client_secret: !!config.client_secret,
        has_refresh_token: !!config.refresh_token,
      });
      return new Response(
        JSON.stringify({ error: 'Configuração do Google Calendar está incompleta. Client ID, Client Secret e Refresh Token são obrigatórios.' }),
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

    const { events, complete } = await listGoogleEvents(
      config.calendar_id,
      accessToken,
      timeMin,
      timeMax,
    );

    if (!complete) {
      return new Response(
        JSON.stringify({ error: 'Não foi possível ler a agenda do Google por completo. Os eventos já salvos foram mantidos.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const timeZone = 'America/Sao_Paulo';
    const rows: Array<Record<string, unknown>> = [];
    const seenIds = new Set<string>();

    for (const event of events) {
      if (!event?.id || event.status === 'cancelled') continue;
      const startDateTime = toTimestamp(event.start, timeZone, false);
      const endDateTime = toTimestamp(event.end, timeZone, true);
      if (!startDateTime || !endDateTime) continue;
      seenIds.add(event.id);
      rows.push({
        google_calendar_config_id: config.id,
        organization_id: config.organization_id,
        google_event_id: event.id,
        summary: event.summary || '',
        description: event.description || '',
        start_datetime: startDateTime,
        end_datetime: endDateTime,
        location: event.location || null,
        html_link: event.htmlLink || null,
        attendees: Array.isArray(event.attendees)
          ? event.attendees.map((attendee: { email?: string; displayName?: string }) => ({
            email: attendee.email || '',
            displayName: attendee.displayName || undefined,
          })).filter((attendee: { email: string }) => attendee.email)
          : null,
      });
    }

    let upserted = 0;
    let errors = 0;
    for (let index = 0; index < rows.length; index += 100) {
      const chunk = rows.slice(index, index + 100);
      const { error: upsertError } = await supabase
        .from('calendar_events')
        .upsert(chunk, {
          onConflict: 'google_calendar_config_id,google_event_id',
          ignoreDuplicates: false,
        });
      if (upsertError) {
        console.error('Erro ao salvar eventos:', upsertError);
        errors += chunk.length;
      } else {
        upserted += chunk.length;
      }
    }

    let removed = 0;
    if (errors === 0) {
      removed = await removeMissingEvents(supabase, config.id, timeMin, timeMax, seenIds);
    }

    if (errors === 0) {
      await supabase
        .from('google_calendar_configs')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', config.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        events_found: events.length,
        inserted: upserted,
        updated: upserted,
        removed,
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

function toTimestamp(
  boundary: { dateTime?: string; date?: string; timeZone?: string } | undefined,
  fallbackTimeZone: string,
  isEnd: boolean,
): string | null {
  if (!boundary) return null;
  if (boundary.dateTime) {
    const parsed = new Date(boundary.dateTime);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (!boundary.date) return null;
  const zone = boundary.timeZone || fallbackTimeZone;
  const instant = zonedTimeToUtc(boundary.date, "00:00:00", zone);
  if (isEnd) {
    return instant.toISOString();
  }
  return instant.toISOString();
}

async function listGoogleEvents(
  calendarId: string,
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<{ events: any[]; complete: boolean }> {
  const events: any[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 20; page++) {
    const eventsUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    eventsUrl.searchParams.set("timeMin", timeMin);
    eventsUrl.searchParams.set("timeMax", timeMax);
    eventsUrl.searchParams.set("maxResults", "2500");
    eventsUrl.searchParams.set("singleEvents", "true");
    eventsUrl.searchParams.set("orderBy", "startTime");
    eventsUrl.searchParams.set("showDeleted", "false");
    if (pageToken) eventsUrl.searchParams.set("pageToken", pageToken);

    const eventsResponse = await fetch(eventsUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error("Erro ao buscar eventos:", errorText);
      return { events, complete: false };
    }
    const eventsData = await eventsResponse.json();
    events.push(...(eventsData.items || []));
    pageToken = eventsData.nextPageToken;
    if (!pageToken) return { events, complete: true };
  }
  console.error("Agenda do Google excedeu o limite de páginas");
  return { events, complete: false };
}

async function removeMissingEvents(
  supabase: ReturnType<typeof createClient>,
  configId: string,
  timeMin: string,
  timeMax: string,
  seenIds: Set<string>,
): Promise<number> {
  const { data: localRows, error } = await supabase
    .from("calendar_events")
    .select("id, google_event_id")
    .eq("google_calendar_config_id", configId)
    .gte("start_datetime", timeMin)
    .lte("start_datetime", timeMax);

  if (error || !localRows?.length) return 0;

  const staleIds = localRows
    .filter((row) => row.google_event_id && !seenIds.has(row.google_event_id))
    .map((row) => row.id);
  if (!staleIds.length) return 0;

  let removed = 0;
  for (let index = 0; index < staleIds.length; index += 100) {
    const chunk = staleIds.slice(index, index + 100);
    const { error: deleteError } = await supabase
      .from("calendar_events")
      .delete()
      .in("id", chunk);
    if (deleteError) {
      console.error("Erro ao remover eventos ausentes no Google:", deleteError);
      continue;
    }
    removed += chunk.length;
  }
  return removed;
}


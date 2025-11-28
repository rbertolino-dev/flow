import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

interface DeleteEventPayload {
  google_calendar_config_id: string;
  google_event_id: string;
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
    let payload: DeleteEventPayload;
    try {
      payload = await req.json() as DeleteEventPayload;
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Payload JSON inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { google_calendar_config_id, google_event_id } = payload;

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

    // Excluir evento no Google Calendar
    const deleteUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendar_id)}/events/${encodeURIComponent(google_event_id)}`;
    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      const errorText = await deleteResponse.text();
      console.error('Erro ao excluir evento:', errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao excluir evento no Google Calendar' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Excluir do cache local
    await supabase
      .from('calendar_events')
      .delete()
      .eq('google_calendar_config_id', google_calendar_config_id)
      .eq('google_event_id', google_event_id);

    return new Response(
      JSON.stringify({ success: true }),
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


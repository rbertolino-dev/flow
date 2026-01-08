import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateBookingRequestPayload {
  organization_slug: string;
  requested_datetime: string; // ISO string
  duration_minutes?: number;
  client_name: string;
  client_email?: string;
  client_phone: string;
  client_notes?: string;
  user_id?: string; // Usuário da organização (opcional, será atribuído automaticamente se não fornecido)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: CreateBookingRequestPayload = await req.json();

    const {
      organization_slug,
      requested_datetime,
      duration_minutes = 60,
      client_name,
      client_email,
      client_phone,
      client_notes,
      user_id,
    } = payload;

    // Validações
    if (!organization_slug || !requested_datetime || !client_name || !client_phone) {
      return new Response(
        JSON.stringify({ error: 'organization_slug, requested_datetime, client_name e client_phone são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar data/hora (deve ser no futuro)
    const requestedDate = new Date(requested_datetime);
    if (requestedDate <= new Date()) {
      return new Response(
        JSON.stringify({ error: 'A data/hora solicitada deve ser no futuro' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configuração da organização
    const { data: config, error: configError } = await supabase
      .from('organization_booking_configs')
      .select('organization_id, default_duration_minutes, require_approval')
      .eq('public_slug', organization_slug)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: 'Organização não encontrada ou agendamento inativo' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o horário está disponível
    const slotEnd = new Date(requestedDate.getTime() + (duration_minutes || config.default_duration_minutes) * 60 * 1000);

    // Buscar eventos próximos ao horário solicitado (verificar conflitos manualmente)
    const { data: nearbyEvents, error: eventsError } = await supabase
      .from('calendar_events')
      .select('start_datetime, end_datetime, organizer_user_id')
      .eq('organization_id', config.organization_id)
      .lte('start_datetime', slotEnd.toISOString())
      .gte('end_datetime', requestedDate.toISOString());

    if (eventsError) {
      console.error('Erro ao verificar conflitos:', eventsError);
    }

    // Verificar conflitos manualmente
    const hasConflict = nearbyEvents?.some(event => {
      const eventStart = new Date(event.start_datetime);
      const eventEnd = new Date(event.end_datetime);
      return (
        (requestedDate >= eventStart && requestedDate < eventEnd) ||
        (slotEnd > eventStart && slotEnd <= eventEnd) ||
        (requestedDate <= eventStart && slotEnd >= eventEnd)
      ) && (!user_id || event.organizer_user_id === user_id);
    });

    if (hasConflict) {
      return new Response(
        JSON.stringify({ error: 'Este horário já está ocupado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar solicitações aprovadas próximas
    const { data: nearbyRequests, error: requestsError } = await supabase
      .from('booking_requests')
      .select('requested_datetime, duration_minutes, user_id')
      .eq('organization_id', config.organization_id)
      .eq('status', 'approved')
      .lte('requested_datetime', slotEnd.toISOString())
      .gte('requested_datetime', new Date(requestedDate.getTime() - 24 * 60 * 60 * 1000).toISOString());

    if (requestsError) {
      console.error('Erro ao verificar solicitações:', requestsError);
    }

    // Verificar conflitos manualmente
    const hasRequestConflict = nearbyRequests?.some(request => {
      const requestStart = new Date(request.requested_datetime);
      const requestEnd = new Date(requestStart.getTime() + (request.duration_minutes || 60) * 60 * 1000);
      return (
        (requestedDate >= requestStart && requestedDate < requestEnd) ||
        (slotEnd > requestStart && slotEnd <= requestEnd) ||
        (requestedDate <= requestStart && slotEnd >= requestEnd)
      ) && (!user_id || request.user_id === user_id);
    });

    if (hasRequestConflict) {
      return new Response(
        JSON.stringify({ error: 'Este horário já está reservado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se user_id não foi fornecido, tentar encontrar um usuário disponível
    let assignedUserId = user_id;
    if (!assignedUserId) {
      // Buscar usuários com disponibilidade no horário solicitado
      const dayOfWeek = requestedDate.getDay();
      const timeStr = requestedDate.toTimeString().slice(0, 8); // HH:mm:ss

      const { data: availableUsers, error: usersError } = await supabase
        .from('user_availability_slots')
        .select('user_id')
        .eq('organization_id', config.organization_id)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .lte('start_time', timeStr)
        .gte('end_time', timeStr)
        .limit(1);

      if (availableUsers && availableUsers.length > 0) {
        assignedUserId = availableUsers[0].user_id;
      }
    }

    // Buscar google_calendar_config_id da organização (primeiro ativo)
    const { data: calendarConfig, error: calendarError } = await supabase
      .from('google_calendar_configs')
      .select('id')
      .eq('organization_id', config.organization_id)
      .eq('is_active', true)
      .limit(1)
      .single();

    // Criar solicitação de agendamento
    const { data: bookingRequest, error: insertError } = await supabase
      .from('booking_requests')
      .insert({
        organization_id: config.organization_id,
        user_id: assignedUserId || null,
        google_calendar_config_id: calendarConfig?.id || null,
        requested_datetime: requestedDate.toISOString(),
        duration_minutes: duration_minutes || config.default_duration_minutes,
        client_name,
        client_email: client_email || null,
        client_phone,
        client_notes: client_notes || null,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar solicitação:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar solicitação de agendamento' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        booking_request: bookingRequest,
        message: 'Solicitação de agendamento criada com sucesso. Aguardando aprovação.',
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


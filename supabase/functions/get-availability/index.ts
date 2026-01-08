import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface GetAvailabilityParams {
  organization_slug: string;
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
  days_ahead?: number; // Quantos dias à frente buscar (padrão: 30)
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
    const url = new URL(req.url);
    const organizationSlug = url.searchParams.get('organization_slug');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const daysAhead = parseInt(url.searchParams.get('days_ahead') || '30');

    if (!organizationSlug) {
      return new Response(
        JSON.stringify({ error: 'organization_slug é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configuração da organização pelo slug
    const { data: config, error: configError } = await supabase
      .from('organization_booking_configs')
      .select('organization_id, default_duration_minutes, timezone')
      .eq('public_slug', organizationSlug)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: 'Organização não encontrada ou agendamento inativo' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calcular datas
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const start = startDate ? new Date(startDate) : today;
    const end = endDate ? new Date(endDate) : new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // Buscar horários disponíveis de todos os usuários da organização
    const { data: availabilitySlots, error: slotsError } = await supabase
      .from('user_availability_slots')
      .select('user_id, day_of_week, start_time, end_time')
      .eq('organization_id', config.organization_id)
      .eq('is_active', true);

    if (slotsError) {
      console.error('Erro ao buscar slots:', slotsError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar horários disponíveis' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar eventos já agendados no Google Calendar (para excluir horários ocupados)
    const { data: existingEvents, error: eventsError } = await supabase
      .from('calendar_events')
      .select('start_datetime, end_datetime, organizer_user_id')
      .eq('organization_id', config.organization_id)
      .gte('start_datetime', start.toISOString())
      .lte('start_datetime', end.toISOString());

    if (eventsError) {
      console.error('Erro ao buscar eventos:', eventsError);
    }

    // Buscar solicitações já aprovadas (para excluir horários ocupados)
    const { data: approvedRequests, error: requestsError } = await supabase
      .from('booking_requests')
      .select('requested_datetime, duration_minutes, user_id')
      .eq('organization_id', config.organization_id)
      .eq('status', 'approved')
      .gte('requested_datetime', start.toISOString())
      .lte('requested_datetime', end.toISOString());

    if (requestsError) {
      console.error('Erro ao buscar solicitações:', requestsError);
    }

    // Gerar slots disponíveis
    const availableSlots: Array<{
      date: string;
      time: string;
      datetime: string;
      user_id: string;
    }> = [];

    // Iterar por cada dia no intervalo
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      const dateStr = currentDate.toISOString().split('T')[0];

      // Encontrar slots disponíveis para este dia da semana
      const daySlots = availabilitySlots?.filter(slot => slot.day_of_week === dayOfWeek) || [];

      for (const slot of daySlots) {
        const startTime = new Date(`${dateStr}T${slot.start_time}`);
        const endTime = new Date(`${dateStr}T${slot.end_time}`);

        // Gerar slots de 30 em 30 minutos (ou duração padrão)
        const slotDuration = config.default_duration_minutes || 60;
        let currentSlot = new Date(startTime);

        while (currentSlot < endTime) {
          const slotEnd = new Date(currentSlot.getTime() + slotDuration * 60 * 1000);
          
          if (slotEnd > endTime) break;

          const slotDateTime = currentSlot.toISOString();
          const slotEndDateTime = slotEnd.toISOString();

          // Verificar se não conflita com eventos existentes
          const hasConflict = existingEvents?.some(event => {
            const eventStart = new Date(event.start_datetime);
            const eventEnd = new Date(event.end_datetime);
            return (
              (currentSlot >= eventStart && currentSlot < eventEnd) ||
              (slotEnd > eventStart && slotEnd <= eventEnd) ||
              (currentSlot <= eventStart && slotEnd >= eventEnd)
            ) && event.organizer_user_id === slot.user_id;
          });

          // Verificar se não conflita com solicitações aprovadas
          const hasRequestConflict = approvedRequests?.some(request => {
            const requestStart = new Date(request.requested_datetime);
            const requestEnd = new Date(requestStart.getTime() + (request.duration_minutes || 60) * 60 * 1000);
            return (
              (currentSlot >= requestStart && currentSlot < requestEnd) ||
              (slotEnd > requestStart && slotEnd <= requestEnd) ||
              (currentSlot <= requestStart && slotEnd >= requestEnd)
            ) && request.user_id === slot.user_id;
          });

          if (!hasConflict && !hasRequestConflict) {
            availableSlots.push({
              date: dateStr,
              time: currentSlot.toTimeString().slice(0, 5), // HH:mm
              datetime: slotDateTime,
              user_id: slot.user_id,
            });
          }

          // Próximo slot (30 minutos depois)
          currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000);
        }
      }

      // Próximo dia
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Ordenar por data/hora
    availableSlots.sort((a, b) => a.datetime.localeCompare(b.datetime));

    return new Response(
      JSON.stringify({
        success: true,
        organization_id: config.organization_id,
        default_duration_minutes: config.default_duration_minutes,
        timezone: config.timezone,
        available_slots: availableSlots,
        total_slots: availableSlots.length,
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


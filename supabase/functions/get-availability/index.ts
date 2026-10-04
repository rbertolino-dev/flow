import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { addCalendarDays, todayInTimeZone, weekdayOfDate, zonedTimeToUtc } from "../_shared/timezone.ts";

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

    const timeZone = config.timezone || "America/Sao_Paulo";

    const rangeStartDate = startDate || todayInTimeZone(timeZone);
    const rangeEndDate = endDate || addCalendarDays(rangeStartDate, daysAhead);
    const rangeStartUtc = zonedTimeToUtc(rangeStartDate, "00:00:00", timeZone);
    const rangeEndUtc = zonedTimeToUtc(addCalendarDays(rangeEndDate, 1), "00:00:00", timeZone);

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
    const existingEvents: Array<{ start_datetime: string; end_datetime: string; organizer_user_id: string | null }> = [];
    for (let from = 0; from < 10000; from += 1000) {
      const { data, error: eventsError } = await supabase
        .from('calendar_events')
        .select('start_datetime, end_datetime, organizer_user_id')
        .eq('organization_id', config.organization_id)
        .lt('start_datetime', rangeEndUtc.toISOString())
        .gt('end_datetime', rangeStartUtc.toISOString())
        .range(from, from + 999);
      if (eventsError) {
        console.error('Erro ao buscar eventos:', eventsError);
        break;
      }
      existingEvents.push(...(data || []));
      if (!data || data.length < 1000) break;
    }

    // Buscar solicitações já aprovadas (para excluir horários ocupados)
    const { data: approvedRequests, error: requestsError } = await supabase
      .from('booking_requests')
      .select('requested_datetime, duration_minutes, user_id')
      .eq('organization_id', config.organization_id)
      .in('status', ['approved', 'pending'])
      .gte('requested_datetime', rangeStartUtc.toISOString())
      .lt('requested_datetime', rangeEndUtc.toISOString());

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

    console.log('Total de slots de disponibilidade encontrados:', availabilitySlots?.length || 0);
    console.log('Slots:', JSON.stringify(availabilitySlots?.slice(0, 5), null, 2));

    const now = new Date();
    let dateStr = rangeStartDate;
    while (dateStr <= rangeEndDate) {
      const dayOfWeek = weekdayOfDate(dateStr);
      const daySlots = availabilitySlots?.filter((slot) => slot.day_of_week === dayOfWeek) || [];

      for (const slot of daySlots) {
        const startClock = String(slot.start_time).slice(0, 8);
        const endClock = String(slot.end_time).slice(0, 8);
        const startTime = zonedTimeToUtc(dateStr, startClock, timeZone);
        let endDateStr = dateStr;
        // Janela que atravessa a meia-noite. Início igual ao fim não vira o dia inteiro.
        if (endClock < startClock) {
          endDateStr = addCalendarDays(dateStr, 1);
        } else if (endClock === startClock) {
          continue;
        }
        const endTime = zonedTimeToUtc(endDateStr, slot.end_time, timeZone);

        const slotDuration = config.default_duration_minutes || 60;
        const slotInterval = 30;
        let currentSlot = new Date(startTime);

        while (currentSlot < endTime) {
          const slotEnd = new Date(currentSlot.getTime() + slotDuration * 60 * 1000);
          if (slotEnd > endTime) break;
          if (currentSlot.getTime() <= now.getTime()) {
            currentSlot = new Date(currentSlot.getTime() + slotInterval * 60 * 1000);
            continue;
          }

          const overlaps = (eventStart: Date, eventEnd: Date) =>
            currentSlot < eventEnd && slotEnd > eventStart;

          const hasConflict = existingEvents?.some((event) => {
            const eventStart = new Date(event.start_datetime);
            const eventEnd = new Date(event.end_datetime);
            const samePerson = !event.organizer_user_id || event.organizer_user_id === slot.user_id;
            return overlaps(eventStart, eventEnd) && samePerson;
          });

          const hasRequestConflict = approvedRequests?.some((request) => {
            const requestStart = new Date(request.requested_datetime);
            const requestEnd = new Date(requestStart.getTime() + (request.duration_minutes || 60) * 60 * 1000);
            const samePerson = !request.user_id || request.user_id === slot.user_id;
            return overlaps(requestStart, requestEnd) && samePerson;
          });

          if (!hasConflict && !hasRequestConflict) {
            const [hours, mins] = wallClock(currentSlot, timeZone);
            availableSlots.push({
              date: dateStr,
              time: `${hours}:${mins}`,
              datetime: currentSlot.toISOString(),
              user_id: slot.user_id,
            });
          }

          currentSlot = new Date(currentSlot.getTime() + slotInterval * 60 * 1000);
        }
      }

      dateStr = addCalendarDays(dateStr, 1);
    }
    
    console.log(`Total de slots disponíveis gerados: ${availableSlots.length}`);

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

function wallClock(instant: Date, timeZone: string): [string, string] {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return [hour === "24" ? "00" : hour, minute];
}


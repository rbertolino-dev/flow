import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useEffect, useState, useCallback } from "react";

export interface CalendarEvent {
  id: string;
  organization_id: string;
  google_calendar_config_id: string;
  google_event_id: string;
  summary: string | null;
  description: string | null;
  start_datetime: string;
  end_datetime: string;
  location: string | null;
  html_link: string | null;
  stage_id: string | null;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  completed_at: string | null;
  completion_notes: string | null;
  organizer_user_id: string | null;
  attendees: Array<{ email: string; displayName?: string }> | null;
  created_at: string;
  updated_at: string;
}

interface UseCalendarEventsOptions {
  startDate?: Date;
  endDate?: Date;
  googleCalendarConfigId?: string;
}

export function useCalendarEvents(options: UseCalendarEventsOptions = {}) {
  const { activeOrgId } = useActiveOrganization();
  const { startDate, endDate, googleCalendarConfigId } = options;
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const { data: initialEvents, isLoading, error, refetch } = useQuery({
    queryKey: [
      "calendar-events",
      activeOrgId,
      startDate?.toISOString(),
      endDate?.toISOString(),
      googleCalendarConfigId,
    ],
    queryFn: async () => {
      if (!activeOrgId) return [];

      let query = supabase
        .from("calendar_events")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("start_datetime", { ascending: true });

      if (startDate) {
        query = query.gte("start_datetime", startDate.toISOString());
      }

      if (endDate) {
        query = query.lte("end_datetime", endDate.toISOString());
      }

      if (googleCalendarConfigId) {
        query = query.eq("google_calendar_config_id", googleCalendarConfigId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as CalendarEvent[];
    },
    enabled: !!activeOrgId,
  });

  // Atualizar eventos quando dados iniciais mudarem
  useEffect(() => {
    if (initialEvents) {
      setEvents(initialEvents);
    }
  }, [initialEvents]);

  // Função para verificar se evento está dentro do range de datas e filtros
  const shouldIncludeEvent = useCallback((event: CalendarEvent): boolean => {
    // Verificar filtro de googleCalendarConfigId
    if (googleCalendarConfigId && event.google_calendar_config_id !== googleCalendarConfigId) {
      return false;
    }
    
    // Verificar range de datas
    if (!startDate && !endDate) return true;
    
    const eventStart = new Date(event.start_datetime);
    const eventEnd = new Date(event.end_datetime);
    
    if (startDate && eventEnd < startDate) return false;
    if (endDate && eventStart > endDate) return false;
    
    return true;
  }, [startDate, endDate, googleCalendarConfigId]);

  // Configurar realtime subscription
  useEffect(() => {
    if (!activeOrgId) return;

    console.log('🔌 Configurando realtime para calendar_events...');

    const channel = supabase
      .channel(`calendar-events-${activeOrgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_events',
          filter: `organization_id=eq.${activeOrgId}`,
        },
        (payload: any) => {
          console.log('📅 Evento do calendário atualizado (realtime):', payload);
          
          const eventType = payload.eventType || payload.type;
          
          if (eventType === 'INSERT') {
            const newEvent = payload.new as CalendarEvent;
            // Verificar se está dentro do range de datas e filtros antes de adicionar
            if (shouldIncludeEvent(newEvent)) {
              setEvents((prev) => {
                if (prev.find(e => e.id === newEvent.id)) return prev;
                return [...prev, newEvent].sort((a, b) => 
                  new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
                );
              });
            }
          } else if (eventType === 'UPDATE') {
            const updatedEvent = payload.new as CalendarEvent;
            setEvents((prev) => {
              const existingIndex = prev.findIndex(e => e.id === updatedEvent.id);
              
              // Se evento existe e ainda está no range, atualizar
              if (existingIndex >= 0 && shouldIncludeEvent(updatedEvent)) {
                return prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e));
              }
              // Se evento existe mas saiu do range, remover
              if (existingIndex >= 0 && !shouldIncludeEvent(updatedEvent)) {
                return prev.filter(e => e.id !== updatedEvent.id);
              }
              // Se evento não existe mas está no range, adicionar
              if (existingIndex < 0 && shouldIncludeEvent(updatedEvent)) {
                return [...prev, updatedEvent].sort((a, b) => 
                  new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
                );
              }
              
              return prev;
            });
          } else if (eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId) {
              setEvents((prev) => prev.filter((e) => e.id !== deletedId));
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status do canal realtime de calendar_events:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Canal realtime de calendar_events conectado!');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('⚠️ Erro no canal realtime de calendar_events:', status);
          // Refetch como fallback
          refetch();
        }
      });

    return () => {
      console.log('🔌 Desconectando realtime de calendar_events');
      supabase.removeChannel(channel);
    };
  }, [activeOrgId, refetch, isEventInDateRange]);

  return {
    events: events || [],
    isLoading,
    error,
  };
}


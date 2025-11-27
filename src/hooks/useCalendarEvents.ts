import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

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

  const { data: events, isLoading, error } = useQuery({
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

  return {
    events: events || [],
    isLoading,
    error,
  };
}


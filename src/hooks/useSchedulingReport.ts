import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import {
  eventDurationMinutes,
  formatDurationMinutes,
  getGoogleCalendarColor,
  NO_COLOR_ID,
} from "@/lib/googleCalendarColors";

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function toIsoStart(date: string) {
  return `${date}T00:00:00.000-03:00`;
}

function toIsoEnd(date: string) {
  return `${date}T23:59:59.999-03:00`;
}

export type SchedulingEventRow = {
  id: string;
  summary: string;
  colorId: string | null;
  colorName: string;
  colorHex: string;
  startDatetime: string;
  endDatetime: string;
  durationMinutes: number;
  durationLabel: string;
  location: string | null;
  status: string | null;
  htmlLink: string | null;
};

export type SchedulingColorSummary = {
  colorId: string;
  colorName: string;
  colorHex: string;
  count: number;
  totalMinutes: number;
  totalDurationLabel: string;
};

export function useSchedulingReport() {
  const { activeOrgId } = useActiveOrganization();
  const initial = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["scheduling-report", activeOrgId, dateFrom, dateTo],
    enabled: !!activeOrgId && !!dateFrom && !!dateTo && dateFrom <= dateTo,
    queryFn: async () => {
      if (!activeOrgId) return [] as SchedulingEventRow[];

      const pageSize = 1000;
      const rows: SchedulingEventRow[] = [];

      for (let from = 0; from < 20000; from += pageSize) {
        const { data, error } = await supabase
          .from("calendar_events")
          .select(
            "id, summary, color_id, start_datetime, end_datetime, location, status, html_link",
          )
          .eq("organization_id", activeOrgId)
          .gte("start_datetime", toIsoStart(dateFrom))
          .lte("start_datetime", toIsoEnd(dateTo))
          .order("start_datetime", { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        type EventRow = {
          id: string;
          summary: string | null;
          color_id: string | null;
          start_datetime: string;
          end_datetime: string;
          location: string | null;
          status: string | null;
          html_link: string | null;
        };

        const page = ((data || []) as EventRow[]).map((item) => {
          const color = getGoogleCalendarColor(item.color_id);
          const durationMinutes = eventDurationMinutes(item.start_datetime, item.end_datetime);
          return {
            id: item.id,
            summary: item.summary || "(Sem título)",
            colorId: item.color_id,
            colorName: color.name,
            colorHex: color.hex,
            startDatetime: item.start_datetime,
            endDatetime: item.end_datetime,
            durationMinutes,
            durationLabel: formatDurationMinutes(durationMinutes),
            location: item.location,
            status: item.status,
            htmlLink: item.html_link,
          } satisfies SchedulingEventRow;
        });

        rows.push(...page);
        if (page.length < pageSize) break;
      }

      return rows;
    },
  });

  const filteredEvents = useMemo(() => {
    const events = query.data || [];
    const term = search.trim().toLowerCase();
    return events.filter((event) => {
      if (colorFilter === NO_COLOR_ID) {
        if (event.colorId) return false;
      } else if (colorFilter !== "all" && event.colorId !== colorFilter) {
        return false;
      }
      if (!term) return true;
      return (
        event.summary.toLowerCase().includes(term) ||
        (event.location || "").toLowerCase().includes(term) ||
        event.colorName.toLowerCase().includes(term)
      );
    });
  }, [query.data, colorFilter, search]);

  const colorSummaries = useMemo(() => {
    const map = new Map<string, SchedulingColorSummary>();
    for (const event of filteredEvents) {
      const key = event.colorId || NO_COLOR_ID;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.totalMinutes += event.durationMinutes;
        existing.totalDurationLabel = formatDurationMinutes(existing.totalMinutes);
      } else {
        map.set(key, {
          colorId: key,
          colorName: event.colorName,
          colorHex: event.colorHex,
          count: 1,
          totalMinutes: event.durationMinutes,
          totalDurationLabel: formatDurationMinutes(event.durationMinutes),
        });
      }
    }
    return [...map.values()].sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [filteredEvents]);

  const totals = useMemo(() => {
    const count = filteredEvents.length;
    const totalMinutes = filteredEvents.reduce((sum, event) => sum + event.durationMinutes, 0);
    return {
      count,
      totalMinutes,
      totalDurationLabel: formatDurationMinutes(totalMinutes),
    };
  }, [filteredEvents]);

  return {
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    colorFilter,
    setColorFilter,
    search,
    setSearch,
    events: filteredEvents,
    colorSummaries,
    totals,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

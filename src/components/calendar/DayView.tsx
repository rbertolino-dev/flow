import { useMemo } from "react";
import { format, isSameDay, startOfDay, endOfDay, eachHourOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarEvent } from "@/hooks/useCalendarEvents";
import { EventCard } from "./EventCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  isLoading?: boolean;
}

export function DayView({ currentDate, events, isLoading }: DayViewProps) {
  const dayStart = startOfDay(currentDate);
  const dayEnd = endOfDay(currentDate);
  const hours = eachHourOfInterval({ start: dayStart, end: dayEnd });

  // Filtrar eventos do dia e ordenar por hora
  const dayEvents = useMemo(() => {
    return events
      .filter((event) => {
        const eventDate = new Date(event.start_datetime);
        return isSameDay(eventDate, currentDate);
      })
      .sort((a, b) => {
        return new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime();
      });
  }, [events, currentDate]);

  // Agrupar eventos por hora
  const eventsByHour = useMemo(() => {
    const grouped = new Map<number, CalendarEvent[]>();
    
    dayEvents.forEach((event) => {
      const eventDate = new Date(event.start_datetime);
      const hour = eventDate.getHours();
      const existing = grouped.get(hour) || [];
      grouped.set(hour, [...existing, event]);
    });

    return grouped;
  }, [dayEvents]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Carregando eventos...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[700px]">
          <div className="space-y-1">
            {hours.map((hour) => {
              const hourNumber = hour.getHours();
              const hourEvents = eventsByHour.get(hourNumber) || [];
              
              return (
                <div key={hourNumber} className="flex gap-4 border-b pb-2">
                  <div className="w-20 flex-shrink-0 pt-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {format(hour, "HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex-1 space-y-2">
                    {hourEvents.length > 0 ? (
                      hourEvents.map((event) => (
                        <EventCard key={event.id} event={event} />
                      ))
                    ) : (
                      <div className="h-1" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}



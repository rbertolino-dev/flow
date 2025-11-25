import { useMemo } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarEvent } from "@/hooks/useCalendarEvents";
import { EventCard } from "./EventCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onDateClick?: (date: Date) => void;
  isLoading?: boolean;
}

export function WeekView({ currentDate, events, onDateClick, isLoading }: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { locale: ptBR });
  const weekEnd = endOfWeek(currentDate, { locale: ptBR });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Agrupar eventos por dia da semana
  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    
    weekDays.forEach((day) => {
      const dateKey = format(day, "yyyy-MM-dd");
      const dayEvents = events.filter((event) => {
        const eventDate = new Date(event.start_datetime);
        return isSameDay(eventDate, day);
      });
      grouped.set(dateKey, dayEvents);
    });

    return grouped;
  }, [events, weekDays]);

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
          Semana de {format(weekStart, "dd 'de' MMMM", { locale: ptBR })} até {format(weekEnd, "dd 'de' MMMM", { locale: ptBR })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDay.get(dateKey) || [];
            const isCurrentDay = isToday(day);
            
            return (
              <div
                key={dateKey}
                className={`border rounded-lg p-3 min-h-[300px] transition-colors cursor-pointer hover:bg-accent/50 ${
                  isCurrentDay ? "bg-primary/10 border-primary border-2" : "bg-muted/30"
                }`}
                onClick={() => onDateClick?.(day)}
              >
                <div className="flex flex-col items-center mb-2">
                  <p className={`text-xs font-medium ${isCurrentDay ? "text-primary" : "text-muted-foreground"}`}>
                    {format(day, "EEE", { locale: ptBR })}
                  </p>
                  <p className={`text-lg font-bold ${isCurrentDay ? "text-primary" : ""}`}>
                    {format(day, "d")}
                  </p>
                  {dayEvents.length > 0 && (
                    <Badge variant="secondary" className="text-xs mt-1">
                      {dayEvents.length}
                    </Badge>
                  )}
                </div>
                <ScrollArea className="h-[220px]">
                  <div className="space-y-2">
                    {dayEvents.slice(0, 5).map((event) => (
                      <div
                        key={event.id}
                        className="text-xs p-2 rounded bg-background border cursor-pointer hover:bg-accent transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <p className="font-medium truncate mb-1">{event.summary || "Sem título"}</p>
                        <p className="text-muted-foreground text-[10px]">
                          {format(new Date(event.start_datetime), "HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    ))}
                    {dayEvents.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-1 font-medium">
                        +{dayEvents.length - 5} mais
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}


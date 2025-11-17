import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { CalendarEvent } from "@/hooks/useCalendarEvents";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Maximize2, Minimize2, List, Calendar as CalendarIcon } from "lucide-react";
import { EventCard } from "./EventCard";
import { CreateEventDialog } from "./CreateEventDialog";

export function CalendarView() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createDialogDate, setCreateDialogDate] = useState<Date | undefined>();
  const [calendarSize, setCalendarSize] = useState<"full" | "compact">("full");
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  // Calcular período para buscar eventos (mês atual + margem)
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const viewStart = startOfWeek(monthStart, { locale: ptBR });
  const viewEnd = endOfWeek(monthEnd, { locale: ptBR });

  // Para lista, buscar mais eventos (últimos 30 dias + próximos 90 dias)
  const listStart = new Date();
  listStart.setDate(listStart.getDate() - 30);
  const listEnd = new Date();
  listEnd.setDate(listEnd.getDate() + 90);

  const { events, isLoading } = useCalendarEvents({
    startDate: viewMode === "list" ? listStart : viewStart,
    endDate: viewMode === "list" ? listEnd : viewEnd,
  });

  // Agrupar eventos por data
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();

    events.forEach((event) => {
      const eventDate = new Date(event.start_datetime);
      const dateKey = format(eventDate, "yyyy-MM-dd");
      const existing = grouped.get(dateKey) || [];
      grouped.set(dateKey, [...existing, event]);
    });

    return grouped;
  }, [events]);

  // Eventos do dia selecionado
  const selectedDayEvents = useMemo(() => {
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate.get(dateKey) || [];
  }, [selectedDate, eventsByDate]);

  // Eventos do mês atual para marcar no calendário
  const monthEvents = useMemo(() => {
    return events.filter((event) => {
      const eventDate = new Date(event.start_datetime);
      return eventDate >= monthStart && eventDate <= monthEnd;
    });
  }, [events, monthStart, monthEnd]);

  // Eventos ordenados por data para lista
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      return new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime();
    });
  }, [events]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleMonthChange = (date: Date | undefined) => {
    if (date) {
      setCurrentMonth(date);
    }
  };

  const handleCreateEvent = (date?: Date) => {
    setCreateDialogDate(date || selectedDate);
    setShowCreateDialog(true);
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const newMonth = new Date(currentMonth);
    if (direction === "prev") {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          {viewMode === "calendar" && (
            <>
              <Button variant="outline" size="icon" onClick={() => navigateMonth("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-2xl font-semibold">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </h2>
              <Button variant="outline" size="icon" onClick={() => navigateMonth("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          {viewMode === "list" && (
            <h2 className="text-2xl font-semibold">Lista de Agendamentos</h2>
          )}
        </div>
        <div className="flex items-center gap-2">
          {viewMode === "calendar" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCalendarSize(calendarSize === "full" ? "compact" : "full")}
            >
              {calendarSize === "full" ? (
                <>
                  <Minimize2 className="h-4 w-4 mr-2" />
                  Reduzir
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4 mr-2" />
                  Expandir
                </>
              )}
            </Button>
          )}
          <Button
            variant={viewMode === "calendar" ? "outline" : "default"}
            size="sm"
            onClick={() => setViewMode("calendar")}
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            Calendário
          </Button>
          <Button
            variant={viewMode === "list" ? "outline" : "default"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4 mr-2" />
            Lista
          </Button>
          <Button onClick={() => handleCreateEvent()}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Evento
          </Button>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <div className={`grid gap-4 ${calendarSize === "full" ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 lg:grid-cols-4"}`}>
          {/* Calendário */}
          <Card className={calendarSize === "full" ? "lg:col-span-2" : "lg:col-span-1"}>
            <CardHeader>
              <CardTitle>Calendário</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={calendarSize === "full" ? "flex justify-center" : ""}>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  month={currentMonth}
                  onMonthChange={handleMonthChange}
                  locale={ptBR}
                  className={`rounded-md border ${calendarSize === "full" ? "scale-110" : ""}`}
                  modifiers={{
                    hasEvents: (date) => {
                      const dateKey = format(date, "yyyy-MM-dd");
                      return eventsByDate.has(dateKey);
                    },
                  }}
                  modifiersClassNames={{
                    hasEvents: "bg-primary/10 font-semibold",
                  }}
                />
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-primary/10" />
                  <span>Dia com eventos</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de eventos do dia selecionado */}
          <Card className={calendarSize === "full" ? "lg:col-span-1" : "lg:col-span-3"}>
            <CardHeader>
              <CardTitle>
                {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm text-muted-foreground">Carregando eventos...</p>
                </div>
              ) : selectedDayEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    Nenhum evento neste dia
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCreateEvent(selectedDate)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Evento
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {selectedDayEvents.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Visualização em Lista */
        <Card>
          <CardHeader>
            <CardTitle>Todos os Agendamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Carregando eventos...</p>
              </div>
            ) : sortedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  Nenhum evento encontrado
                </p>
                <Button onClick={() => handleCreateEvent()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Evento
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {sortedEvents.map((event) => (
                    <EventCard 
                      key={event.id} 
                      event={event}
                      onClick={() => {
                        setSelectedDate(new Date(event.start_datetime));
                        setViewMode("calendar");
                      }}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      <CreateEventDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        defaultDate={createDialogDate}
        onEventCreated={() => {
          // Os eventos serão atualizados automaticamente pelo hook
        }}
      />
    </div>
  );
}


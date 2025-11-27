import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { CalendarEvent } from "@/hooks/useCalendarEvents";
import { useGoogleCalendarConfigs } from "@/hooks/useGoogleCalendarConfigs";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Maximize2, Minimize2, List, Calendar as CalendarIcon, Grid3x3, CalendarDays } from "lucide-react";
import { EventCard } from "./EventCard";
import { CreateEventDialog } from "./CreateEventDialog";
import { EditEventDialog } from "./EditEventDialog";
import { ScheduleMessageDialog } from "./ScheduleMessageDialog";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Filter } from "lucide-react";

export function CalendarView() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { configs } = useGoogleCalendarConfigs();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [currentDay, setCurrentDay] = useState<Date>(new Date());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createDialogDate, setCreateDialogDate] = useState<Date | undefined>();
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [schedulingEvent, setSchedulingEvent] = useState<CalendarEvent | null>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [calendarSize, setCalendarSize] = useState<"full" | "compact">("full");
  const [viewMode, setViewMode] = useState<"month" | "week" | "day" | "list">("month");
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);

  // Calcular período para buscar eventos baseado na visualização
  const getDateRange = () => {
    switch (viewMode) {
      case "day":
        return {
          start: startOfDay(currentDay),
          end: endOfDay(currentDay),
        };
      case "week":
        const weekStart = startOfWeek(currentWeek, { locale: ptBR });
        const weekEnd = endOfWeek(currentWeek, { locale: ptBR });
        return {
          start: startOfDay(weekStart),
          end: endOfDay(weekEnd),
        };
      case "list":
        const listStart = new Date();
        listStart.setDate(listStart.getDate() - 30);
        const listEnd = new Date();
        listEnd.setDate(listEnd.getDate() + 90);
        return { start: listStart, end: listEnd };
      default: // month
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const viewStart = startOfWeek(monthStart, { locale: ptBR });
        const viewEnd = endOfWeek(monthEnd, { locale: ptBR });
        return { start: viewStart, end: viewEnd };
    }
  };

  const dateRange = getDateRange();
  const { events: allEvents, isLoading } = useCalendarEvents({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  // Filtrar eventos por contas selecionadas
  const events = useMemo(() => {
    if (selectedCalendarIds.length === 0) {
      return allEvents;
    }
    return allEvents.filter((event) => selectedCalendarIds.includes(event.google_calendar_config_id));
  }, [allEvents, selectedCalendarIds]);

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
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return events.filter((event) => {
      const eventDate = new Date(event.start_datetime);
      return eventDate >= monthStart && eventDate <= monthEnd;
    });
  }, [events, currentMonth]);

  // Eventos ordenados por data para lista
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      return new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime();
    });
  }, [events]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setCurrentDay(date);
      setCurrentWeek(date);
    }
  };

  const handleMonthChange = (date: Date | undefined) => {
    if (date) {
      setCurrentMonth(date);
    }
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setShowEditDialog(true);
  };

  const handleDeleteEvent = async (event: CalendarEvent) => {
    if (!confirm(`Tem certeza que deseja excluir o evento "${event.summary}"?`)) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("delete-google-calendar-event", {
        body: {
          google_calendar_config_id: event.google_calendar_config_id,
          google_event_id: event.google_event_id,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({
        title: "Evento excluído!",
        description: "O evento foi excluído do Google Calendar.",
      });

      await queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir evento",
        description: error.message || "Não foi possível excluir o evento.",
        variant: "destructive",
      });
    }
  };

  const handleScheduleMessage = (event: CalendarEvent) => {
    setSchedulingEvent(event);
    setShowScheduleDialog(true);
  };

  const navigateWeek = (direction: "prev" | "next") => {
    const newWeek = new Date(currentWeek);
    if (direction === "prev") {
      newWeek.setDate(newWeek.getDate() - 7);
    } else {
      newWeek.setDate(newWeek.getDate() + 7);
    }
    setCurrentWeek(newWeek);
  };

  const navigateDay = (direction: "prev" | "next") => {
    const newDay = new Date(currentDay);
    if (direction === "prev") {
      newDay.setDate(newDay.getDate() - 1);
    } else {
      newDay.setDate(newDay.getDate() + 1);
    }
    setCurrentDay(newDay);
  };

  const handleCreateEvent = (date?: Date) => {
    const targetDate = date || selectedDate;
    console.log("handleCreateEvent called", { date, selectedDate, targetDate });
    setCreateDialogDate(targetDate);
    setShowCreateDialog(true);
    console.log("showCreateDialog set to true, state should update");
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

  const activeConfigs = configs.filter((c) => c.is_active);

  return (
    <div className="space-y-4">
      {/* Filtros e controles */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Navegação por período */}
          {viewMode === "month" && (
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
          {viewMode === "week" && (
            <>
              <Button variant="outline" size="icon" onClick={() => navigateWeek("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-2xl font-semibold">
                Semana de {format(startOfWeek(currentWeek, { locale: ptBR }), "dd/MM", { locale: ptBR })} até {format(endOfWeek(currentWeek, { locale: ptBR }), "dd/MM/yyyy", { locale: ptBR })}
              </h2>
              <Button variant="outline" size="icon" onClick={() => navigateWeek("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          {viewMode === "day" && (
            <>
              <Button variant="outline" size="icon" onClick={() => navigateDay("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-2xl font-semibold">
                {format(currentDay, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </h2>
              <Button variant="outline" size="icon" onClick={() => navigateDay("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          {viewMode === "list" && (
            <h2 className="text-2xl font-semibold">Lista de Agendamentos</h2>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro por conta */}
          {activeConfigs.length > 1 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                  {selectedCalendarIds.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedCalendarIds.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="end">
                <div className="space-y-3">
                  <div className="font-medium text-sm">Filtrar por conta</div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="filter-all"
                        checked={selectedCalendarIds.length === 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedCalendarIds([]);
                          }
                        }}
                      />
                      <label
                        htmlFor="filter-all"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Todas as contas
                      </label>
                    </div>
                    {activeConfigs.map((config) => (
                      <div key={config.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`filter-${config.id}`}
                          checked={selectedCalendarIds.includes(config.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCalendarIds([...selectedCalendarIds, config.id]);
                            } else {
                              setSelectedCalendarIds(selectedCalendarIds.filter(id => id !== config.id));
                            }
                          }}
                        />
                        <label
                          htmlFor={`filter-${config.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                        >
                          {config.account_name}
                        </label>
                      </div>
                    ))}
                  </div>
                  {selectedCalendarIds.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => setSelectedCalendarIds([])}
                    >
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
          
          {/* Botões de visualização */}
          <div className="flex items-center gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("month")}
              className="h-8"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
              className="h-8"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "day" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("day")}
              className="h-8"
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-8"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {viewMode === "month" && (
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
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCreateEvent();
            }}
            type="button"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Evento
          </Button>
        </div>
      </div>

      {/* Badge com contagem de eventos */}
      {events.length > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {events.length} evento{events.length !== 1 ? "s" : ""} encontrado{events.length !== 1 ? "s" : ""}
          </Badge>
          {selectedCalendarIds.length > 0 && (
            <Badge variant="outline">
              Filtrado por {selectedCalendarIds.length} conta{selectedCalendarIds.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      )}

      {viewMode === "month" ? (
        <div className={`grid gap-4 ${calendarSize === "full" ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 lg:grid-cols-4"}`}>
          {/* Calendário - Maior e mais proeminente */}
          <Card className={calendarSize === "full" ? "lg:col-span-2" : "lg:col-span-1"}>
            <CardHeader>
              <CardTitle>Calendário Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={calendarSize === "full" ? "flex justify-center py-4" : "py-2"}>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  month={currentMonth}
                  onMonthChange={handleMonthChange}
                  locale={ptBR}
                  className={`rounded-md border ${calendarSize === "full" ? "scale-125" : ""}`}
                  modifiers={{
                    hasEvents: (date) => {
                      const dateKey = format(date, "yyyy-MM-dd");
                      return eventsByDate.has(dateKey);
                    },
                  }}
                  modifiersClassNames={{
                    hasEvents: "bg-primary/20 font-semibold border-primary/50",
                  }}
                />
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-primary/20 border border-primary/50" />
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
                      <EventCard 
                        key={event.id} 
                        event={event}
                        onEdit={() => handleEditEvent(event)}
                        onDelete={() => handleDeleteEvent(event)}
                        onScheduleMessage={() => handleScheduleMessage(event)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      ) : viewMode === "week" ? (
        <WeekView
          currentDate={currentWeek}
          events={events}
          onDateClick={(date) => {
            setSelectedDate(date);
            setCurrentDay(date);
            setViewMode("day");
          }}
          isLoading={isLoading}
        />
      ) : viewMode === "day" ? (
        <DayView
          currentDate={currentDay}
          events={events}
          isLoading={isLoading}
          onScheduleMessage={handleScheduleMessage}
        />
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
                        setViewMode("month");
                      }}
                      onEdit={() => handleEditEvent(event)}
                      onDelete={() => handleDeleteEvent(event)}
                      onScheduleMessage={() => handleScheduleMessage(event)}
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
        onOpenChange={(open) => {
          console.log("CreateEventDialog onOpenChange called", open);
          setShowCreateDialog(open);
        }}
        defaultDate={createDialogDate}
        onEventCreated={() => {
          // Os eventos serão atualizados automaticamente pelo hook
          queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
        }}
      />

      <EditEventDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        event={editingEvent}
        onEventUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
        }}
        onEventDeleted={() => {
          queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
        }}
      />

      <ScheduleMessageDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        event={schedulingEvent}
        onMessageScheduled={() => {
          // Mensagem agendada com sucesso
        }}
      />
    </div>
  );
}


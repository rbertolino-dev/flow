import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek,
  eachDayOfInterval, 
  isToday, 
  isPast, 
  startOfDay, 
  getDay,
  addWeeks,
  subWeeks
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, Users, ChevronLeft, ChevronRight, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ScheduledCampaign {
  id: string;
  name: string;
  scheduled_start_at: string;
  instance_id: string | null;
  instance_name?: string;
  instance_names?: string[]; // Todas as instâncias
  sending_method?: string;
  total_contacts: number;
  status: string;
  min_delay_seconds?: number;
  max_delay_seconds?: number;
  last_message_scheduled_at?: string; // Última mensagem agendada
}

interface BroadcastCampaignsCalendarProps {
  organizationId: string;
}

export function BroadcastCampaignsCalendar({ organizationId }: BroadcastCampaignsCalendarProps) {
  const [viewMode, setViewMode] = useState<"week" | "month">("week"); // Semanal como padrão
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null); // Dia selecionado para visualização focada
  const [campaigns, setCampaigns] = useState<ScheduledCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [instancesMap, setInstancesMap] = useState<Map<string, string>>(new Map());

  // Buscar instâncias para mapear IDs para nomes
  useEffect(() => {
    const fetchInstances = async () => {
      if (!organizationId) return;
      
      const { data } = await supabase
        .from("evolution_config")
        .select("id, instance_name")
        .eq("organization_id", organizationId);
      
      if (data) {
        const map = new Map<string, string>();
        data.forEach(instance => {
          map.set(instance.id, instance.instance_name || "Sem nome");
        });
        setInstancesMap(map);
      }
    };
    
    fetchInstances();
  }, [organizationId]);

  // Buscar campanhas agendadas com dados completos
  useEffect(() => {
    const fetchScheduledCampaigns = async () => {
      if (!organizationId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Buscar campanhas com scheduled_start_at e delays
        const { data, error } = await supabase
          .from("broadcast_campaigns")
          .select(`
            id,
            name,
            scheduled_start_at,
            instance_id,
            sending_method,
            total_contacts,
            status,
            min_delay_seconds,
            max_delay_seconds
          `)
          .eq("organization_id", organizationId)
          .not("scheduled_start_at", "is", null)
          .in("status", ["draft", "running", "paused"])
          .order("scheduled_start_at", { ascending: true });

        if (error) throw error;

        // Para cada campanha, buscar dados adicionais da fila
        const campaignsWithDetails = await Promise.all(
          (data || []).map(async (campaign) => {
            // Buscar última mensagem agendada e instâncias da fila
            const { data: queueData } = await supabase
              .from("broadcast_queue")
              .select("instance_id, scheduled_for")
              .eq("campaign_id", campaign.id)
              .in("status", ["scheduled", "pending"])
              .order("scheduled_for", { ascending: false })
              .limit(1000);
            
            let instanceName = "Instância desconhecida";
            let instanceNames: string[] = [];
            let lastMessageScheduledAt: string | undefined;
            
            if (queueData && queueData.length > 0) {
              const scheduledMessages = queueData.filter(q => q.scheduled_for);
              if (scheduledMessages.length > 0) {
                const sortedMessages = scheduledMessages.sort((a, b) => {
                  const dateA = new Date(a.scheduled_for).getTime();
                  const dateB = new Date(b.scheduled_for).getTime();
                  return dateB - dateA;
                });
                lastMessageScheduledAt = sortedMessages[0].scheduled_for;
              }
              
              const uniqueInstanceIds = [...new Set(queueData.map(item => item.instance_id).filter(Boolean))];
              
              if (uniqueInstanceIds.length > 0) {
                instanceNames = uniqueInstanceIds
                  .map(id => instancesMap.get(id))
                  .filter(Boolean) as string[];
                
                if (instanceNames.length > 0) {
                  if (instanceNames.length === 1) {
                    instanceName = instanceNames[0];
                  } else if (instanceNames.length <= 2) {
                    instanceName = instanceNames.join(", ");
                  } else {
                    instanceName = `${instanceNames.slice(0, 2).join(", ")} +${instanceNames.length - 2}`;
                  }
                } else {
                  instanceName = `${uniqueInstanceIds.length} instância(s)`;
                }
              } else {
                instanceName = "Múltiplas instâncias";
              }
            } else if (campaign.sending_method === "rotate" || campaign.sending_method === "separate") {
              instanceName = "Múltiplas instâncias";
            } else if (campaign.instance_id && instancesMap.has(campaign.instance_id)) {
              instanceName = instancesMap.get(campaign.instance_id) || "Instância desconhecida";
              instanceNames = [instanceName];
            }
            
            if (!lastMessageScheduledAt) {
              lastMessageScheduledAt = campaign.scheduled_start_at;
            }

            const finalLastMessageAt = lastMessageScheduledAt || campaign.scheduled_start_at;

            return {
              ...campaign,
              instance_name: instanceName,
              instance_names: instanceNames.length > 0 ? instanceNames : [instanceName],
              last_message_scheduled_at: finalLastMessageAt,
            };
          })
        );

        setCampaigns(campaignsWithDetails);
      } catch (error) {
        console.error("Erro ao buscar campanhas agendadas:", error);
      } finally {
        setLoading(false);
      }
    };

    if (instancesMap.size > 0) {
      fetchScheduledCampaigns();
    }
  }, [organizationId, instancesMap]);

  // Agrupar campanhas por dia
  const campaignsByDate = useMemo(() => {
    const map = new Map<string, ScheduledCampaign[]>();
    
    campaigns.forEach(campaign => {
      if (campaign.scheduled_start_at) {
        const dateKey = format(new Date(campaign.scheduled_start_at), "yyyy-MM-dd");
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(campaign);
      }
    });
    
    return map;
  }, [campaigns]);

  // Gerar dias da semana
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 }); // Domingo
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Gerar dias do mês com espaços vazios no início
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });
    
    // Adicionar dias vazios no início para alinhar com os dias da semana
    const firstDayOfWeek = getDay(start); // 0 = Domingo, 6 = Sábado
    const emptyDays = Array(firstDayOfWeek).fill(null);
    
    return [...emptyDays, ...days];
  }, [currentDate]);

  // Navegar períodos
  const previousPeriod = () => {
    if (viewMode === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    }
  };

  const nextPeriod = () => {
    if (viewMode === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDay(null); // Limpar seleção ao voltar para hoje
  };

  // Limpar seleção de dia
  const clearSelectedDay = () => {
    setSelectedDay(null);
  };

  // Obter campanhas de um dia específico
  const getCampaignsForDay = (day: Date) => {
    const dateKey = format(day, "yyyy-MM-dd");
    return campaignsByDate.get(dateKey) || [];
  };

  // Formatar horário
  const formatTime = (dateString: string) => {
    return format(new Date(dateString), "HH:mm", { locale: ptBR });
  };

  // Formatar data completa
  const formatFullDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  // Formatar período da semana
  const formatWeekRange = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });
    if (format(start, "MMM", { locale: ptBR }) === format(end, "MMM", { locale: ptBR })) {
      return `${format(start, "d", { locale: ptBR })} - ${format(end, "d 'de' MMMM yyyy", { locale: ptBR })}`;
    }
    return `${format(start, "d 'de' MMM", { locale: ptBR })} - ${format(end, "d 'de' MMM yyyy", { locale: ptBR })}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Programação de Campanhas
          </CardTitle>
          <div className="flex items-center gap-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "week" | "month")}>
              <TabsList>
                <TabsTrigger value="week">Semanal</TabsTrigger>
                <TabsTrigger value="month">Mensal</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              size="sm"
              onClick={previousPeriod}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="h-8 px-3 text-xs"
            >
              Hoje
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={nextPeriod}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {viewMode === "week" 
            ? formatWeekRange()
            : format(currentDate, "MMMM yyyy", { locale: ptBR })
          }
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {viewMode === "week" ? (
            // Visualização Semanal
            <div className="space-y-4">
              {selectedDay ? (
                // Modo foco: mostrar apenas o dia selecionado
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">
                      {format(selectedDay, "EEEE, d 'de' MMMM yyyy", { locale: ptBR })}
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSelectedDay}
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      Voltar para semana
                    </Button>
                  </div>
                  <div className="border rounded-lg p-4 min-h-[600px]">
                    <ScrollArea className="h-[600px]">
                      <div className="space-y-3">
                        {getCampaignsForDay(selectedDay).map((campaign) => (
                          <div
                            key={campaign.id}
                            className={cn(
                              "p-4 rounded-lg border bg-background cursor-pointer transition-all hover:shadow-lg",
                              campaign.status === "draft" && "border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20",
                              campaign.status === "running" && "border-green-500/50 bg-green-500/10 hover:bg-green-500/20",
                              campaign.status === "paused" && "border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20"
                            )}
                          >
                            <div className="font-semibold text-base mb-2 break-words">
                              {campaign.name}
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span className="font-medium">Horário:</span>
                                <span>{formatFullDate(campaign.scheduled_start_at)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Users className="h-4 w-4" />
                                <span className="font-medium">Instância(s):</span>
                                <span className="break-words">{campaign.instance_name}</span>
                              </div>
                              {campaign.total_contacts > 0 && (
                                <div className="text-muted-foreground">
                                  <span className="font-medium">{campaign.total_contacts}</span> contato(s)
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {getCampaignsForDay(selectedDay).length === 0 && (
                          <div className="text-center py-12 text-muted-foreground">
                            <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p className="font-medium">Nenhuma campanha neste dia</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              ) : (
                // Modo normal: mostrar todos os dias da semana
                <div className="grid grid-cols-7 gap-3">
                  {weekDays.map((day) => {
                    const dayCampaigns = getCampaignsForDay(day);
                    const isCurrentDay = isToday(day);
                    const isPastDay = isPast(startOfDay(day)) && !isCurrentDay;

                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "min-h-[400px] border rounded-lg p-3 transition-all cursor-pointer",
                          isCurrentDay && "border-primary bg-primary/5 shadow-sm",
                          isPastDay && "opacity-50",
                          !isPastDay && "hover:border-primary/50 hover:bg-muted/30"
                        )}
                        onClick={() => setSelectedDay(day)}
                      >
                        <div className="mb-3">
                          <div
                            className={cn(
                              "text-xs font-medium text-muted-foreground mb-1",
                              isCurrentDay && "text-primary font-semibold"
                            )}
                          >
                            {format(day, "EEE", { locale: ptBR })}
                          </div>
                          <div
                            className={cn(
                              "text-lg font-semibold",
                              isCurrentDay && "text-primary",
                              isPastDay && "text-muted-foreground"
                            )}
                          >
                            {format(day, "d")}
                          </div>
                        </div>
                        
                        <ScrollArea className="h-[350px]">
                          <div className="space-y-2">
                            {dayCampaigns.map((campaign) => (
                              <div
                                key={campaign.id}
                                className={cn(
                                  "text-xs p-2 rounded-lg border bg-background transition-all hover:shadow-md",
                                  campaign.status === "draft" && "border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20",
                                  campaign.status === "running" && "border-green-500/50 bg-green-500/10 hover:bg-green-500/20",
                                  campaign.status === "paused" && "border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20"
                                )}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="font-semibold mb-1 break-words line-clamp-2">
                                  {campaign.name}
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                    <Clock className="h-3 w-3 flex-shrink-0" />
                                    <span>{formatTime(campaign.scheduled_start_at)}</span>
                                  </div>
                                  <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                                    <Users className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                    <span className="break-words line-clamp-2">{campaign.instance_name}</span>
                                  </div>
                                  {campaign.total_contacts > 0 && (
                                    <div className="text-[11px] text-muted-foreground">
                                      {campaign.total_contacts} contato(s)
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                            {dayCampaigns.length === 0 && (
                              <div className="text-xs text-muted-foreground text-center py-4">
                                Nenhuma campanha
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            // Visualização Mensal
            <div className="space-y-4">
              <div className="grid grid-cols-7 gap-2 mb-4">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {monthDays.map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${index}`} className="min-h-[100px]" />;
                  }

                  const dayCampaigns = getCampaignsForDay(day);
                  const isCurrentDay = isToday(day);
                  const isPastDay = isPast(startOfDay(day)) && !isCurrentDay;

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "min-h-[100px] border rounded-lg p-2 transition-all",
                        isCurrentDay && "border-primary bg-primary/5 shadow-sm",
                        isPastDay && "opacity-50",
                        !isPastDay && "hover:border-primary/50 hover:bg-muted/30"
                      )}
                    >
                      <div
                        className={cn(
                          "text-sm font-medium mb-2",
                          isCurrentDay && "text-primary font-semibold",
                          isPastDay && "text-muted-foreground"
                        )}
                      >
                        {format(day, "d")}
                      </div>
                      
                      {dayCampaigns.length > 0 && (
                        <ScrollArea className="h-[80px]">
                          <div className="space-y-1.5">
                            {dayCampaigns.slice(0, 3).map((campaign) => (
                              <div
                                key={campaign.id}
                                className={cn(
                                  "text-xs p-1.5 rounded border bg-background cursor-pointer transition-colors hover:shadow-sm",
                                  campaign.status === "draft" && "border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20",
                                  campaign.status === "running" && "border-green-500/50 bg-green-500/10 hover:bg-green-500/20",
                                  campaign.status === "paused" && "border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20"
                                )}
                                title={`${campaign.name} - ${formatFullDate(campaign.scheduled_start_at)}`}
                              >
                                <div className="font-medium truncate mb-0.5">
                                  {campaign.name}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <Clock className="h-2.5 w-2.5" />
                                  {formatTime(campaign.scheduled_start_at)}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                                  <Users className="h-2.5 w-2.5" />
                                  <span className="truncate">{campaign.instance_name}</span>
                                </div>
                              </div>
                            ))}
                            {dayCampaigns.length > 3 && (
                              <div className="text-xs text-muted-foreground text-center py-1 font-medium">
                                +{dayCampaigns.length - 3} mais
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lista detalhada de campanhas */}
          {campaigns.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-sm font-semibold mb-3">
                Todas as Campanhas Agendadas ({campaigns.length})
              </h3>
              <ScrollArea className="h-[400px] [&>[data-radix-scroll-area-viewport]]:pr-4">
                <style>{`
                  [data-radix-scroll-area-viewport]::-webkit-scrollbar {
                    width: 12px;
                  }
                  [data-radix-scroll-area-viewport]::-webkit-scrollbar-track {
                    background: hsl(var(--muted));
                    border-radius: 6px;
                  }
                  [data-radix-scroll-area-viewport]::-webkit-scrollbar-thumb {
                    background: hsl(var(--muted-foreground) / 0.3);
                    border-radius: 6px;
                    border: 2px solid hsl(var(--muted));
                  }
                  [data-radix-scroll-area-viewport]::-webkit-scrollbar-thumb:hover {
                    background: hsl(var(--muted-foreground) / 0.5);
                  }
                `}</style>
                <div className="space-y-2 pr-2">
                  {campaigns.map((campaign) => {
                    const hasMultipleInstances = campaign.instance_names && campaign.instance_names.length > 2;
                    const displayInstances = campaign.instance_names?.slice(0, 2) || [];
                    
                    return (
                      <div
                        key={campaign.id}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <CalendarIcon className="h-4 w-4 text-primary" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <h4 className="font-medium break-words">{campaign.name}</h4>
                            <Badge
                              variant={
                                campaign.status === "draft"
                                  ? "secondary"
                                  : campaign.status === "running"
                                  ? "default"
                                  : "outline"
                              }
                              className="text-xs flex-shrink-0"
                            >
                              {campaign.status === "draft"
                                ? "Agendada"
                                : campaign.status === "running"
                                ? "Em execução"
                                : "Pausada"}
                            </Badge>
                          </div>
                          <div className="space-y-1.5">
                            {/* Horários */}
                            <div className="flex flex-wrap items-center gap-3 text-xs">
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="font-medium">Início:</span>
                                <span>{formatFullDate(campaign.scheduled_start_at)}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="font-medium">Término:</span>
                                <span>{formatFullDate(campaign.last_message_scheduled_at || campaign.scheduled_start_at)}</span>
                              </div>
                            </div>
                            
                            {/* Delay e Instâncias */}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              {campaign.min_delay_seconds && campaign.max_delay_seconds && (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium">Delay:</span>
                                  <span>{campaign.min_delay_seconds}s - {campaign.max_delay_seconds}s</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="font-medium">Instância(s):</span>
                                <div className="flex items-center gap-1">
                                  {displayInstances.map((name, idx) => (
                                    <span key={idx}>{name}{idx < displayInstances.length - 1 ? ", " : ""}</span>
                                  ))}
                                  {hasMultipleInstances && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center gap-1 cursor-help hover:text-foreground transition-colors">
                                            <Plus className="h-3 w-3" />
                                            <span>+{campaign.instance_names!.length - 2}</span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <div className="space-y-1">
                                            <p className="font-medium">Todas as instâncias:</p>
                                            {campaign.instance_names!.map((name, idx) => (
                                              <p key={idx} className="text-xs">• {name}</p>
                                            ))}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium">{campaign.total_contacts}</span>
                                <span>contatos</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {campaigns.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Nenhuma campanha agendada</p>
              <p className="text-sm mt-1">
                As campanhas agendadas aparecerão aqui
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

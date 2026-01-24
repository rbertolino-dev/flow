import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isPast, startOfDay, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, Users, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ScheduledCampaign {
  id: string;
  name: string;
  scheduled_start_at: string;
  instance_id: string | null;
  instance_name?: string;
  sending_method?: string;
  total_contacts: number;
  status: string;
}

interface BroadcastCampaignsCalendarProps {
  organizationId: string;
}

export function BroadcastCampaignsCalendar({ organizationId }: BroadcastCampaignsCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
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

  // Buscar campanhas agendadas
  useEffect(() => {
    const fetchScheduledCampaigns = async () => {
      if (!organizationId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Buscar campanhas com scheduled_start_at
        const { data, error } = await supabase
          .from("broadcast_campaigns")
          .select(`
            id,
            name,
            scheduled_start_at,
            instance_id,
            sending_method,
            total_contacts,
            status
          `)
          .eq("organization_id", organizationId)
          .not("scheduled_start_at", "is", null)
          .in("status", ["draft", "running", "paused"])
          .order("scheduled_start_at", { ascending: true });

        if (error) throw error;

        // Para campanhas com múltiplas instâncias, buscar instâncias da fila
        const campaignsWithInstances = await Promise.all(
          (data || []).map(async (campaign) => {
            let instanceName = "Instância desconhecida";
            
            if (campaign.sending_method === "rotate" || campaign.sending_method === "separate") {
              // Buscar instâncias únicas da fila
              const { data: queueData } = await supabase
                .from("broadcast_queue")
                .select("instance_id")
                .eq("campaign_id", campaign.id)
                .limit(100);
              
              if (queueData && queueData.length > 0) {
                const uniqueInstanceIds = [...new Set(queueData.map(item => item.instance_id).filter(Boolean))];
                if (uniqueInstanceIds.length > 0) {
                  const instanceNames = uniqueInstanceIds
                    .map(id => instancesMap.get(id))
                    .filter(Boolean)
                    .slice(0, 3); // Mostrar até 3 nomes
                  
                  if (instanceNames.length > 0) {
                    instanceName = instanceNames.length === 1
                      ? instanceNames[0]!
                      : `${instanceNames.join(", ")}${uniqueInstanceIds.length > 3 ? ` +${uniqueInstanceIds.length - 3}` : ""}`;
                  } else {
                    instanceName = `${uniqueInstanceIds.length} instância(s)`;
                  }
                } else {
                  instanceName = "Múltiplas instâncias";
                }
              } else {
                instanceName = "Múltiplas instâncias";
              }
            } else if (campaign.instance_id && instancesMap.has(campaign.instance_id)) {
              instanceName = instancesMap.get(campaign.instance_id) || "Instância desconhecida";
            }

            return {
              ...campaign,
              instance_name: instanceName,
            };
          })
        );

        setCampaigns(campaignsWithInstances);
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

  // Gerar dias do mês com espaços vazios no início
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    
    // Adicionar dias vazios no início para alinhar com os dias da semana
    const firstDayOfWeek = getDay(start); // 0 = Domingo, 6 = Sábado
    const emptyDays = Array(firstDayOfWeek).fill(null);
    
    return [...emptyDays, ...days];
  }, [currentMonth]);

  // Navegar meses
  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
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
            <Button
              variant="outline"
              size="sm"
              onClick={previousMonth}
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
              onClick={nextMonth}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Grid de dias */}
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
              // Se for dia vazio (null), renderizar célula vazia
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

          {/* Lista detalhada de campanhas do mês */}
          {campaigns.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-sm font-semibold mb-4">
                Todas as Campanhas Agendadas ({campaigns.length})
              </h3>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="flex items-start gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <CalendarIcon className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-medium truncate">{campaign.name}</h4>
                          <Badge
                            variant={
                              campaign.status === "draft"
                                ? "secondary"
                                : campaign.status === "running"
                                ? "default"
                                : "outline"
                            }
                            className="text-xs"
                          >
                            {campaign.status === "draft"
                              ? "Agendada"
                              : campaign.status === "running"
                              ? "Em execução"
                              : "Pausada"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            <span>{formatFullDate(campaign.scheduled_start_at)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users className="h-4 w-4" />
                            <span>{campaign.instance_name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{campaign.total_contacts}</span>
                            <span>contatos</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
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

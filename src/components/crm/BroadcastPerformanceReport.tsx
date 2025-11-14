import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, XAxis, YAxis, Legend, Cell } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarIcon } from "lucide-react";
import { format as formatDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import { subDays, subMonths, startOfDay, endOfDay } from "date-fns";

interface PerformanceReportProps {
  campaigns: any[];
  instances: any[];
  dateFilter?: Date;
}

export function BroadcastPerformanceReport({ campaigns, instances, dateFilter: externalDateFilter }: PerformanceReportProps) {
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  // Função para filtrar campanhas com base no período e datas
  const getFilteredCampaigns = () => {
    let filtered = campaigns;

    // Aplicar filtro de período
    if (periodFilter !== "all" && periodFilter !== "custom") {
      const now = new Date();
      let cutoffDate: Date;

      switch (periodFilter) {
        case "7days":
          cutoffDate = subDays(now, 7);
          break;
        case "30days":
          cutoffDate = subDays(now, 30);
          break;
        case "3months":
          cutoffDate = subMonths(now, 3);
          break;
        case "6months":
          cutoffDate = subMonths(now, 6);
          break;
        default:
          cutoffDate = new Date(0);
      }

      filtered = filtered.filter(campaign => {
        const sentDate = campaign.started_at ? new Date(campaign.started_at) : null;
        return sentDate && sentDate >= cutoffDate;
      });
    }

    // Aplicar filtro de data customizado
    if (periodFilter === "custom") {
      if (startDate) {
        filtered = filtered.filter(campaign => {
          const sentDate = campaign.started_at ? new Date(campaign.started_at) : null;
          return sentDate && sentDate >= startOfDay(startDate);
        });
      }
      if (endDate) {
        filtered = filtered.filter(campaign => {
          const sentDate = campaign.started_at ? new Date(campaign.started_at) : null;
          return sentDate && sentDate <= endOfDay(endDate);
        });
      }
    }

    // Aplicar filtro de data externa (vindo do componente pai)
    if (externalDateFilter) {
      filtered = filtered.filter(campaign => {
        const sentDate = campaign.started_at ? new Date(campaign.started_at) : null;
        if (!sentDate) return false;
        return sentDate.toDateString() === externalDateFilter.toDateString();
      });
    }

    return filtered;
  };

  const filteredCampaigns = getFilteredCampaigns();

  // Calcular dados reais da fila para cada campanha
  const getCampaignStats = (campaign: any) => {
    const queueItems = campaign.broadcast_queue || [];
    const sent = queueItems.filter((q: any) => q.status === 'sent').length;
    const failed = queueItems.filter((q: any) => q.status === 'failed').length;
    const cancelled = queueItems.filter((q: any) => q.status === 'cancelled').length;
    const pending = queueItems.filter((q: any) => q.status === 'pending').length;
    const total = campaign.total_contacts || 0;
    
    return { sent, failed, cancelled, pending, total };
  };

  // Taxa de sucesso geral
  const successRateData = filteredCampaigns.map(campaign => {
    const stats = getCampaignStats(campaign);
    return {
      name: campaign.name,
      sucesso: stats.sent,
      falha: stats.failed,
      cancelado: stats.cancelled,
      pendente: stats.pending,
      total: stats.total,
      taxa: stats.total > 0 
        ? ((stats.sent / stats.total) * 100).toFixed(1)
        : 0
    };
  });

  // Análise por horário (agrupado por hora do dia)
  const hourlyEngagement = filteredCampaigns.reduce((acc: any[], campaign) => {
    const queueItems = campaign.broadcast_queue || [];
    queueItems.forEach((item: any) => {
      if (!item.sent_at) return;
      const hour = new Date(item.sent_at).getHours();
      const existing = acc.find(h => h.hora === hour);
      if (existing) {
        existing.enviados += 1;
      } else {
        acc.push({ 
          hora: hour, 
          horaLabel: `${hour}:00`,
          enviados: 1 
        });
      }
    });
    return acc;
  }, []).sort((a, b) => a.hora - b.hora);

  // Análise por dia da semana
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const dailyEngagement = filteredCampaigns.reduce((acc: any[], campaign) => {
    const queueItems = campaign.broadcast_queue || [];
    queueItems.forEach((item: any) => {
      if (!item.sent_at) return;
      const day = new Date(item.sent_at).getDay();
      const existing = acc.find(d => d.dia === day);
      if (existing) {
        existing.enviados += 1;
      } else {
        acc.push({
          dia: day,
          diaLabel: weekdays[day],
          enviados: 1
        });
      }
    });
    return acc;
  }, []).sort((a, b) => a.dia - b.dia);

  // Disparos por instância
  const instanceData = instances.map(instance => {
    const instanceCampaigns = filteredCampaigns.filter(c => 
      c.instance_id === instance.id || c.instance_name === instance.instance_name
    );
    
    let totalSent = 0;
    let totalFailed = 0;
    
    instanceCampaigns.forEach(campaign => {
      const queueItems = campaign.broadcast_queue || [];
      totalSent += queueItems.filter((q: any) => q.status === 'sent').length;
      totalFailed += queueItems.filter((q: any) => q.status === 'failed').length;
    });
    
    return {
      name: instance.instance_name,
      enviados: totalSent,
      falhas: totalFailed,
      total: totalSent + totalFailed,
      campanhas: instanceCampaigns.length
    };
  }).filter(item => item.total > 0);

  // Calcular totais gerais
  const totalStats = {
    totalEnviados: 0,
    totalFalhas: 0,
    totalCancelados: 0,
    totalPendentes: 0,
    totalContatos: filteredCampaigns.reduce((sum, c) => sum + (c.total_contacts || 0), 0),
    totalCampanhas: filteredCampaigns.length,
    taxaSucesso: 0
  };
  
  filteredCampaigns.forEach(campaign => {
    const queueItems = campaign.broadcast_queue || [];
    totalStats.totalEnviados += queueItems.filter((q: any) => q.status === 'sent').length;
    totalStats.totalFalhas += queueItems.filter((q: any) => q.status === 'failed').length;
    totalStats.totalCancelados += queueItems.filter((q: any) => q.status === 'cancelled').length;
    totalStats.totalPendentes += queueItems.filter((q: any) => q.status === 'pending').length;
  });
  
  const totalGeral = totalStats.totalEnviados + totalStats.totalFalhas;
  if (totalGeral > 0) {
    totalStats.taxaSucesso = ((totalStats.totalEnviados / totalGeral) * 100);
  }

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#8b5cf6', '#f59e0b'];

  const chartConfig = {
    sucesso: {
      label: "Sucesso",
      color: "hsl(var(--primary))",
    },
    falha: {
      label: "Falha",
      color: "hsl(var(--destructive))",
    },
    enviados: {
      label: "Enviados",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="space-y-6 pr-4">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os períodos</SelectItem>
                  <SelectItem value="7days">Últimos 7 dias</SelectItem>
                  <SelectItem value="30days">Últimos 30 dias</SelectItem>
                  <SelectItem value="3months">Últimos 3 meses</SelectItem>
                  <SelectItem value="6months">Últimos 6 meses</SelectItem>
                  <SelectItem value="custom">Período customizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {periodFilter === "custom" && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[200px] justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? formatDate(startDate, "PPP", { locale: ptBR }) : "Data inicial"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[200px] justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? formatDate(endDate, "PPP", { locale: ptBR }) : "Data final"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>

                {(startDate || endDate) && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setStartDate(undefined);
                      setEndDate(undefined);
                    }}
                  >
                    Limpar datas
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Campanhas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalCampanhas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Enviados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalStats.totalEnviados}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Falhas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{totalStats.totalFalhas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Sucesso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{totalStats.taxaSucesso.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Taxa de Sucesso por Campanha */}
      <Card>
        <CardHeader>
          <CardTitle>Taxa de Sucesso por Campanha</CardTitle>
        </CardHeader>
        <CardContent>
          {successRateData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={successRateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="sucesso" fill="hsl(var(--primary))" name="Sucesso" />
                <Bar dataKey="falha" fill="hsl(var(--destructive))" name="Falha" />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum dado disponível para o período selecionado</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Melhor Horário de Engajamento */}
        <Card>
          <CardHeader>
            <CardTitle>Envios por Horário</CardTitle>
          </CardHeader>
          <CardContent>
            {hourlyEngagement.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <LineChart data={hourlyEngagement}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="horaLabel" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line type="monotone" dataKey="enviados" stroke="hsl(var(--primary))" name="Enviados" />
                </LineChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
            )}
          </CardContent>
        </Card>

        {/* Melhor Dia de Engajamento */}
        <Card>
          <CardHeader>
            <CardTitle>Envios por Dia da Semana</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyEngagement.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={dailyEngagement}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="diaLabel" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="enviados" fill="hsl(var(--primary))" name="Enviados" />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Disparos por Instância */}
      <Card>
        <CardHeader>
          <CardTitle>Disparos por Instância</CardTitle>
        </CardHeader>
        <CardContent>
          {instanceData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={instanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="enviados" fill="hsl(var(--primary))" name="Enviados" />
                  <Bar dataKey="falhas" fill="hsl(var(--destructive))" name="Falhas" />
                </BarChart>
              </ChartContainer>
              <div className="space-y-2">
                <div className="font-semibold mb-3 text-lg">Resumo por Instância</div>
                {instanceData.map((item, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <Badge variant="outline">{item.campanhas} campanhas</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <div className="text-muted-foreground">Total</div>
                        <div className="font-semibold">{item.total}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Enviados</div>
                        <div className="font-semibold text-primary">{item.enviados}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Falhas</div>
                        <div className="font-semibold text-destructive">{item.falhas}</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Taxa de sucesso: {item.total > 0 ? ((item.enviados / item.total) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
          )}
        </CardContent>
      </Card>
    </div>
    </ScrollArea>
  );
}

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, BarChart3, TrendingUp, Calendar as CalendarIcon2, Filter } from "lucide-react";
import { format, startOfMonth, endOfMonth, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend, Cell, Pie, PieChart } from "recharts";
import { formatSaoPauloDateTime } from "@/lib/dateUtils";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0'];

export function CalendarEventsReport() {
  const { stages } = usePipelineStages();
  const [dateFilterMode, setDateFilterMode] = useState<'thisMonth' | 'last30Days' | 'last90Days' | 'custom'>('thisMonth');
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  // Calcular datas baseado no modo
  const getDateRange = () => {
    const now = new Date();
    switch (dateFilterMode) {
      case 'thisMonth':
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
        };
      case 'last30Days':
        return {
          start: subDays(now, 30),
          end: now,
        };
      case 'last90Days':
        return {
          start: subDays(now, 90),
          end: now,
        };
      case 'custom':
        return {
          start: startDate || subDays(now, 30),
          end: endDate || now,
        };
      default:
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
        };
    }
  };

  const dateRange = getDateRange();
  const { events, isLoading } = useCalendarEvents({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  // Agrupar eventos por etapa
  const eventsByStage = useMemo(() => {
    const grouped: Record<string, { stage: any; count: number; events: any[] }> = {
      'sem-etiqueta': {
        stage: { id: 'sem-etiqueta', name: 'Sem Etiqueta', color: '#9ca3af' },
        count: 0,
        events: [],
      },
    };

    events.forEach((event) => {
      const stageId = event.stage_id || 'sem-etiqueta';
      if (!grouped[stageId]) {
        const stage = stages.find(s => s.id === stageId);
        grouped[stageId] = {
          stage: stage || { id: stageId, name: 'Etiqueta Removida', color: '#9ca3af' },
          count: 0,
          events: [],
        };
      }
      grouped[stageId].count++;
      grouped[stageId].events.push(event);
    });

    return Object.values(grouped).sort((a, b) => b.count - a.count);
  }, [events, stages]);

  // Dados para gráfico de barras
  const barChartData = useMemo(() => {
    return eventsByStage.map((item) => ({
      name: item.stage.name,
      quantidade: item.count,
      cor: item.stage.color,
    }));
  }, [eventsByStage]);

  // Dados para gráfico de pizza
  const pieChartData = useMemo(() => {
    return eventsByStage.map((item) => ({
      name: item.stage.name,
      value: item.count,
      color: item.stage.color,
    }));
  }, [eventsByStage]);

  const totalEvents = events.length;
  const totalStages = eventsByStage.filter(item => item.count > 0).length;

  const chartConfig = {
    quantidade: {
      label: "Quantidade",
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho com Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Relatório de Reuniões por Etiquetas
          </CardTitle>
          <CardDescription>
            Análise detalhada das reuniões agrupadas por etiquetas do funil
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex items-center gap-2 flex-wrap">
              <Label>Período:</Label>
              <Button
                variant={dateFilterMode === 'thisMonth' ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDateFilterMode('thisMonth');
                  const now = new Date();
                  setStartDate(startOfMonth(now));
                  setEndDate(endOfMonth(now));
                }}
              >
                Este mês
              </Button>
              <Button
                variant={dateFilterMode === 'last30Days' ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDateFilterMode('last30Days');
                  const now = new Date();
                  setStartDate(subDays(now, 30));
                  setEndDate(now);
                }}
              >
                Últimos 30 dias
              </Button>
              <Button
                variant={dateFilterMode === 'last90Days' ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDateFilterMode('last90Days');
                  const now = new Date();
                  setStartDate(subDays(now, 90));
                  setEndDate(now);
                }}
              >
                Últimos 90 dias
              </Button>
              <Button
                variant={dateFilterMode === 'custom' ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilterMode('custom')}
              >
                <Filter className="h-4 w-4 mr-2" />
                Personalizado
              </Button>
            </div>

            {dateFilterMode === 'custom' && (
              <div className="flex items-center gap-2 flex-wrap">
                <Popover open={showStartCalendar} onOpenChange={setShowStartCalendar}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-[240px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Data inicial"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        setStartDate(date);
                        setShowStartCalendar(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover open={showEndCalendar} onOpenChange={setShowEndCalendar}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-[240px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Data final"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => {
                        setEndDate(date);
                        setShowEndCalendar(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {dateFilterMode !== 'custom' && (
            <div className="mt-4 text-sm text-muted-foreground">
              Período: {format(dateRange.start, "dd/MM/yyyy", { locale: ptBR })} até {format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Reuniões</CardTitle>
            <CalendarIcon2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEvents}</div>
            <p className="text-xs text-muted-foreground">
              No período selecionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Etiquetas Utilizadas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStages}</div>
            <p className="text-xs text-muted-foreground">
              Etiquetas com reuniões
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média por Etiqueta</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalStages > 0 ? Math.round(totalEvents / totalStages) : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Reuniões por etiqueta
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Barras */}
        <Card>
          <CardHeader>
            <CardTitle>Reuniões por Etiqueta</CardTitle>
            <CardDescription>Distribuição de reuniões por etiqueta do funil</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-sm text-muted-foreground">Carregando dados...</p>
              </div>
            ) : barChartData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="quantidade" fill="hsl(var(--primary))" name="Quantidade" />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-sm text-muted-foreground">Nenhum dado disponível no período selecionado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Pizza */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Etiqueta</CardTitle>
            <CardDescription>Percentual de reuniões por etiqueta</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-sm text-muted-foreground">Carregando dados...</p>
              </div>
            ) : pieChartData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-sm text-muted-foreground">Nenhum dado disponível no período selecionado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Etiqueta</CardTitle>
          <CardDescription>Lista completa de reuniões agrupadas por etiqueta</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Carregando dados...</p>
            </div>
          ) : eventsByStage.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Nenhuma reunião encontrada no período selecionado</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {eventsByStage.map((item) => (
                  <div key={item.stage.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: item.stage.color }}
                        />
                        <h3 className="font-semibold">{item.stage.name}</h3>
                        <Badge variant="secondary">{item.count} reunião{item.count !== 1 ? 'ões' : ''}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.count > 0 ? `${((item.count / totalEvents) * 100).toFixed(1)}%` : '0%'} do total
                      </div>
                    </div>
                    <div className="space-y-2">
                      {item.events.slice(0, 5).map((event) => (
                        <div key={event.id} className="text-sm p-2 bg-muted rounded">
                          <div className="font-medium">{event.summary || "Sem título"}</div>
                          <div className="text-muted-foreground">
                            {formatSaoPauloDateTime(event.start_datetime)}
                          </div>
                        </div>
                      ))}
                      {item.events.length > 5 && (
                        <div className="text-sm text-muted-foreground text-center pt-2">
                          +{item.events.length - 5} reunião{item.events.length - 5 !== 1 ? 'ões' : ''} mais
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


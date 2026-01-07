import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarIcon, BarChart3, Users, Filter } from "lucide-react";
import { Label } from "@/components/ui/label";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, startOfWeek, endOfWeek, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useOrganizationUsers } from "@/hooks/useOrganizationUsers";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend } from "recharts";
import { formatSaoPauloDateTime } from "@/lib/dateUtils";

export function BookedMeetingsReport() {
  const { users: organizationUsers } = useOrganizationUsers();
  const [dateFilterMode, setDateFilterMode] = useState<'today' | 'thisWeek' | 'thisMonth' | 'custom'>('thisMonth');
  const now = new Date();

  // Calcular datas baseado no modo
  const dateRange = useMemo(() => {
    switch (dateFilterMode) {
      case 'today':
        return {
          start: startOfDay(now),
          end: endOfDay(now),
        };
      case 'thisWeek':
        return {
          start: startOfDay(startOfWeek(now, { weekStartsOn: 1 })),
          end: endOfDay(endOfWeek(now, { weekStartsOn: 1 })),
        };
      case 'thisMonth':
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
        };
      default:
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
        };
    }
  }, [dateFilterMode, now]);
  
  const { events, isLoading } = useCalendarEvents({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  // Agrupar eventos por quem marcou
  const eventsByBookedBy = useMemo(() => {
    const grouped: Record<string, { 
      user: any; 
      total: number; 
      completed: number; 
      events: any[] 
    }> = {};

    events.forEach((event) => {
      const userId = (event as any).booked_by_user_id || 'sem-usuario';
      if (!grouped[userId]) {
        const user = organizationUsers.find(u => u.id === userId);
        grouped[userId] = {
          user: user || { id: userId, full_name: 'Sem usuário', email: '' },
          total: 0,
          completed: 0,
          events: [],
        };
      }
      grouped[userId].total++;
      if ((event as any).status === 'completed') {
        grouped[userId].completed++;
      }
      grouped[userId].events.push(event);
    });

    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [events, organizationUsers]);

  const totalEvents = events.length;
  const totalUsers = eventsByBookedBy.length;

  // Dados para gráfico
  const chartData = useMemo(() => {
    return eventsByBookedBy.map((item) => ({
      name: item.user.full_name || item.user.email || 'Sem usuário',
      total: item.total,
      realizadas: item.completed,
    }));
  }, [eventsByBookedBy]);

  const chartConfig = {
    total: {
      label: "Total",
      color: "hsl(var(--chart-1))",
    },
    realizadas: {
      label: "Realizadas",
      color: "#10b981",
    },
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho com Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Relatório de Reuniões Marcadas por Pessoa
          </CardTitle>
          <CardDescription>
            Análise de reuniões agendadas por cada pessoa da equipe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex items-center gap-2 flex-wrap">
              <Label>Período:</Label>
              <Button
                variant={dateFilterMode === 'today' ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilterMode('today')}
              >
                Hoje
              </Button>
              <Button
                variant={dateFilterMode === 'thisWeek' ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilterMode('thisWeek')}
              >
                Esta Semana
              </Button>
              <Button
                variant={dateFilterMode === 'thisMonth' ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilterMode('thisMonth')}
              >
                Este Mês
              </Button>
            </div>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            Período: {format(dateRange.start, "dd/MM/yyyy", { locale: ptBR })} até {format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}
          </div>
        </CardContent>
      </Card>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Reuniões</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
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
            <CardTitle className="text-sm font-medium">Pessoas que Marcaram</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              Pessoas com reuniões marcadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reuniões Realizadas</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {eventsByBookedBy.reduce((sum, item) => sum + item.completed, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalEvents > 0 
                ? `${Math.round((eventsByBookedBy.reduce((sum, item) => sum + item.completed, 0) / totalEvents) * 100)}% do total`
                : '0% do total'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico */}
      <Card>
        <CardHeader>
          <CardTitle>Reuniões Marcadas por Pessoa</CardTitle>
          <CardDescription>Distribuição de reuniões agendadas por cada membro da equipe</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-sm text-muted-foreground">Carregando dados...</p>
            </div>
          ) : chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={chartData}>
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
                <Bar dataKey="total" fill="hsl(var(--primary))" name="Total" />
                <Bar dataKey="realizadas" fill="#10b981" name="Realizadas" />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-sm text-muted-foreground">Nenhum dado disponível no período selecionado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Pessoa</CardTitle>
          <CardDescription>Lista completa de reuniões marcadas por cada pessoa</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Carregando dados...</p>
            </div>
          ) : eventsByBookedBy.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Nenhuma reunião encontrada no período selecionado</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pessoa</TableHead>
                    <TableHead>Total de Reuniões</TableHead>
                    <TableHead>Realizadas</TableHead>
                    <TableHead>Taxa de Conclusão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventsByBookedBy.map((item) => {
                    const completionRate = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
                    return (
                      <TableRow key={item.user.id}>
                        <TableCell className="font-medium">
                          {item.user.full_name || item.user.email || 'Sem usuário'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.total}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                            {item.completed}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-2">
                              <div
                                className="bg-green-600 h-2 rounded-full transition-all"
                                style={{ width: `${completionRate}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{completionRate}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Lista de Reuniões por Pessoa */}
      <Card>
        <CardHeader>
          <CardTitle>Reuniões Detalhadas por Pessoa</CardTitle>
          <CardDescription>Lista completa de todas as reuniões marcadas por cada pessoa</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Carregando dados...</p>
            </div>
          ) : eventsByBookedBy.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Nenhuma reunião encontrada no período selecionado</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-6">
                {eventsByBookedBy.map((item) => (
                  <div key={item.user.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">
                          {item.user.full_name || item.user.email || 'Sem usuário'}
                        </h3>
                        <Badge variant="secondary">{item.total} reunião{item.total !== 1 ? 'ões' : ''}</Badge>
                        {item.completed > 0 && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                            {item.completed} realizada{item.completed !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.total > 0 ? `${((item.total / totalEvents) * 100).toFixed(1)}%` : '0%'} do total
                      </div>
                    </div>
                    <div className="space-y-2">
                      {item.events.map((event) => (
                        <div key={event.id} className="text-sm p-3 bg-muted rounded-lg">
                          <div className="font-medium mb-1">{event.summary || "Sem título"}</div>
                          <div className="text-muted-foreground mb-1">
                            {formatSaoPauloDateTime(event.start_datetime)}
                          </div>
                          {event.status === 'completed' && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 mt-1">
                              Realizada
                            </Badge>
                          )}
                          {event.status === 'cancelled' && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 mt-1">
                              Cancelada
                            </Badge>
                          )}
                        </div>
                      ))}
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


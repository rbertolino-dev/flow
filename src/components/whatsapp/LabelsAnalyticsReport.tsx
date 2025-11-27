import { useState, useMemo } from "react";
import { useLabelsReport } from "@/hooks/useLabelsReport";
import { useAllChatwootConversations } from "@/hooks/useAllChatwootConversations";
import { useChatwootChats } from "@/hooks/useChatwootChats";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Download, TrendingDown, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const chartConfig = {
  conversations: {
    label: "Conversas",
    color: "hsl(142, 76%, 36%)",
  },
  messagesReceived: {
    label: "Mensagens Recebidas",
    color: "hsl(217, 91%, 60%)",
  },
  messagesSent: {
    label: "Mensagens Enviadas",
    color: "hsl(262, 83%, 58%)",
  },
};

export const LabelsAnalyticsReport = () => {
  const { activeOrgId } = useActiveOrganization();
  const { report } = useLabelsReport();
  const { data: inboxesData } = useChatwootChats(activeOrgId);
  const inboxes = Array.isArray(inboxesData) ? inboxesData : [];
  const { conversations: allConversations = [] } = useAllChatwootConversations(activeOrgId, inboxes);

  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(null);
  const [duration, setDuration] = useState<"7" | "30" | "90">("30");
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
  const [businessHoursOnly, setBusinessHoursOnly] = useState(false);

  const selectedLabel = useMemo(() => {
    if (!selectedLabelId) return null;
    return report.find(r => r.labelId === selectedLabelId);
  }, [report, selectedLabelId]);

  // Filtrar conversas por etiqueta e período
  const filteredConversations = useMemo(() => {
    if (!selectedLabelId) return [];
    
    const daysBack = parseInt(duration);
    const startDate = startOfDay(subDays(new Date(), daysBack));
    const endDate = endOfDay(new Date());

    return allConversations.filter((conv: any) => {
      // Verificar se tem a etiqueta selecionada
      const convLabels = conv.labels || [];
      const hasLabel = convLabels.some((label: any) => {
        const labelId = typeof label === 'object' ? label.id : label;
        return labelId === selectedLabelId;
      });

      if (!hasLabel) return false;

      // Verificar data
      const convDate = conv.timestamp 
        ? new Date(conv.timestamp * 1000)
        : new Date(conv.created_at || Date.now());
      
      if (convDate < startDate || convDate > endDate) return false;

      // Verificar horário comercial (9h-18h)
      if (businessHoursOnly) {
        const hour = convDate.getHours();
        if (hour < 9 || hour >= 18) return false;
      }

      return true;
    });
  }, [allConversations, selectedLabelId, duration, businessHoursOnly]);

  // Agrupar dados por período
  const chartData = useMemo(() => {
    const daysBack = parseInt(duration);
    const startDate = startOfDay(subDays(new Date(), daysBack));
    const endDate = endOfDay(new Date());
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);

      const dayConversations = filteredConversations.filter((conv: any) => {
        const convDate = conv.timestamp 
          ? new Date(conv.timestamp * 1000)
          : new Date(conv.created_at || Date.now());
        return convDate >= dayStart && convDate <= dayEnd;
      });

      // Contar mensagens
      let messagesReceived = 0;
      let messagesSent = 0;

      dayConversations.forEach((conv: any) => {
        const messages = conv.messages || [];
        messages.forEach((msg: any) => {
          if (msg.message_type === 'incoming' || msg.message_type === 0) {
            messagesReceived++;
          } else {
            messagesSent++;
          }
        });
      });

      return {
        date: format(day, "dd-MMM", { locale: ptBR }),
        conversations: dayConversations.length,
        messagesReceived,
        messagesSent,
      };
    });
  }, [filteredConversations, duration]);

  // Calcular métricas
  const metrics = useMemo(() => {
    const totalConversations = filteredConversations.length;
    let totalMessagesReceived = 0;
    let totalMessagesSent = 0;
    let firstResponseTimes: number[] = [];
    let resolutionTimes: number[] = [];
    let resolvedCount = 0;

    filteredConversations.forEach((conv: any) => {
      const messages = conv.messages || [];
      let firstIncomingTime: Date | null = null;
      let firstResponseTime: Date | null = null;

      messages.forEach((msg: any) => {
        const msgDate = msg.created_at ? parseISO(msg.created_at) : new Date();
        
        if (msg.message_type === 'incoming' || msg.message_type === 0) {
          totalMessagesReceived++;
          if (!firstIncomingTime) {
            firstIncomingTime = msgDate;
          }
        } else {
          totalMessagesSent++;
          if (firstIncomingTime && !firstResponseTime) {
            firstResponseTime = msgDate;
            const diff = (firstResponseTime.getTime() - firstIncomingTime.getTime()) / 1000 / 60; // minutos
            firstResponseTimes.push(diff);
          }
        }
      });

      if (conv.status === 'resolved') {
        resolvedCount++;
        const created = conv.created_at ? parseISO(conv.created_at) : new Date();
        const resolved = conv.updated_at ? parseISO(conv.updated_at) : new Date();
        const diff = (resolved.getTime() - created.getTime()) / 1000; // segundos
        resolutionTimes.push(diff);
      }
    });

    const avgFirstResponse = firstResponseTimes.length > 0
      ? firstResponseTimes.reduce((a, b) => a + b, 0) / firstResponseTimes.length
      : 0;

    const avgResolution = resolutionTimes.length > 0
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      : 0;

    // Calcular variação (simulado - comparar com período anterior)
    const prevPeriodConversations = Math.floor(totalConversations * 1.19); // Simulação
    const conversationChange = prevPeriodConversations > 0
      ? ((totalConversations - prevPeriodConversations) / prevPeriodConversations) * 100
      : 0;

    return {
      totalConversations,
      totalMessagesReceived,
      totalMessagesSent,
      avgFirstResponse,
      avgResolution,
      resolvedCount,
      conversationChange,
      messagesReceivedChange: -2, // Simulado
      messagesSentChange: -17, // Simulado
    };
  }, [filteredConversations]);

  const formatTime = (minutes: number) => {
    if (minutes < 1) return "0 Min";
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes % 1) * 60);
    if (hours > 0) return `${hours}h ${mins}min`;
    return `${mins} Min ${secs} Sec`;
  };

  const formatSeconds = (seconds: number) => {
    if (seconds < 60) return `${Math.floor(seconds)} Sec`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (minutes < 60) return `${minutes} Min ${secs} Sec`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const handleDownload = () => {
    // Implementar download do relatório
    const data = {
      label: selectedLabel?.labelTitle || 'Todas',
      duration,
      metrics,
      chartData,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-etiquetas-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Visão Geral das Etiquetas</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Análise detalhada de conversas e mensagens por etiqueta
          </p>
        </div>
        <Button onClick={handleDownload} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Baixar relatórios de etiquetas
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <Label className="mb-2">Selecionar Etiqueta</Label>
          <Select
            value={selectedLabelId?.toString() || "all"}
            onValueChange={(value) => setSelectedLabelId(value === "all" ? null : parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma etiqueta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Etiquetas</SelectItem>
              {report.map((label) => (
                <SelectItem key={label.labelId} value={label.labelId.toString()}>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: label.labelColor }}
                    />
                    {label.labelTitle}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[150px]">
          <Label className="mb-2">Duração</Label>
          <Select value={duration} onValueChange={(value: "7" | "30" | "90") => setDuration(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[150px]">
          <Label className="mb-2">Agrupar por</Label>
          <Select value={groupBy} onValueChange={(value: "day" | "week" | "month") => setGroupBy(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Dia</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mês</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 p-2 border rounded-lg">
          <Switch
            id="business-hours"
            checked={businessHoursOnly}
            onCheckedChange={setBusinessHoursOnly}
          />
          <Label htmlFor="business-hours" className="cursor-pointer">
            Horário Comercial
          </Label>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Conversas</CardTitle>
                <CardDescription className="text-2xl font-bold mt-2">
                  {metrics.totalConversations}
                </CardDescription>
              </div>
              <Badge
                variant={metrics.conversationChange >= 0 ? "default" : "destructive"}
                className="flex items-center gap-1"
              >
                {metrics.conversationChange >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(metrics.conversationChange).toFixed(0)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="conversations" fill={chartConfig.conversations.color} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Mensagens Recebidas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Mensagens recebidas</CardTitle>
                <CardDescription className="text-2xl font-bold mt-2">
                  {metrics.totalMessagesReceived}
                </CardDescription>
              </div>
              <Badge
                variant={metrics.messagesReceivedChange >= 0 ? "default" : "destructive"}
                className="flex items-center gap-1"
              >
                {metrics.messagesReceivedChange >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(metrics.messagesReceivedChange)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="messagesReceived" fill={chartConfig.messagesReceived.color} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Mensagens Enviadas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Mensagens enviadas</CardTitle>
                <CardDescription className="text-2xl font-bold mt-2">
                  {metrics.totalMessagesSent}
                </CardDescription>
              </div>
              <Badge
                variant={metrics.messagesSentChange >= 0 ? "default" : "destructive"}
                className="flex items-center gap-1"
              >
                {metrics.messagesSentChange >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(metrics.messagesSentChange)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="messagesSent" fill={chartConfig.messagesSent.color} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tempo de Primeira Resposta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTime(metrics.avgFirstResponse)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Média de tempo para primeira resposta
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tempo de Resolução
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatSeconds(metrics.avgResolution)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Média de tempo para resolução
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Contagem de Resoluções
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.resolvedCount}</div>
            <p className="text-sm text-muted-foreground mt-1">
              Total de conversas resolvidas
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};


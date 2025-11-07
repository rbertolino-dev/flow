import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CallQueueItem } from "@/types/lead";
import { Phone, CheckCircle2, Clock, TrendingUp, Tag as TagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTags } from "@/hooks/useTags";
import { format, isToday, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CallQueueStatsProps {
  callQueue: CallQueueItem[];
}

export function CallQueueStats({ callQueue }: CallQueueStatsProps) {
  const { tags: allTags } = useTags();
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [selectedTagId, setSelectedTagId] = useState<string>("all");

  // Filtrar chamadas baseado nos filtros selecionados
  const filteredCalls = callQueue.filter(call => {
    // Filtro por data (apenas para concluídas)
    if (call.status === "completed" && call.completedAt) {
      const completedDate = new Date(call.completedAt);
      const from = startOfDay(dateFrom);
      const to = endOfDay(dateTo);
      
      if (isBefore(completedDate, from) || isAfter(completedDate, to)) {
        return false;
      }
    }

    // Filtro por etiqueta
    if (selectedTagId !== "all") {
      const callTagIds = [
        ...(call.tags?.map(t => t.id) || []),
        ...(call.queueTags?.map(t => t.id) || [])
      ];
      if (!callTagIds.includes(selectedTagId)) {
        return false;
      }
    }

    return true;
  });

  // Chamadas de hoje
  const todayCalls = filteredCalls.filter(call => 
    call.completedAt && isToday(new Date(call.completedAt))
  );

  // Estatísticas gerais
  const totalPending = filteredCalls.filter(c => c.status === "pending").length;
  const totalCompleted = filteredCalls.filter(c => c.status === "completed").length;
  const totalRescheduled = filteredCalls.filter(c => c.status === "rescheduled").length;
  const completionRate = callQueue.length > 0 
    ? Math.round((totalCompleted / (totalPending + totalCompleted + totalRescheduled)) * 100) 
    : 0;

  // Estatísticas por etiqueta
  const callsByTag: Record<string, { total: number; completed: number; pending: number; tag: any }> = {};
  
  filteredCalls.forEach(call => {
    const tags = [...(call.tags || []), ...(call.queueTags || [])];
    tags.forEach(tag => {
      if (!callsByTag[tag.id]) {
        callsByTag[tag.id] = { total: 0, completed: 0, pending: 0, tag };
      }
      callsByTag[tag.id].total++;
      if (call.status === "completed") {
        callsByTag[tag.id].completed++;
      } else if (call.status === "pending") {
        callsByTag[tag.id].pending++;
      }
    });
  });

  const tagStats = Object.values(callsByTag).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros do Relatório</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "PPP", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => date && setDateFrom(date)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data Final</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "PPP", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => date && setDateTo(date)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Filtrar por Etiqueta</label>
              <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as etiquetas" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Todas as etiquetas</SelectItem>
                  {allTags.map(tag => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setDateFrom(new Date());
              setDateTo(new Date());
              setSelectedTagId("all");
            }}
          >
            Limpar Filtros
          </Button>
        </CardContent>
      </Card>

      {/* Indicadores Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ligações de Hoje</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayCalls.length}</div>
            <p className="text-xs text-muted-foreground">
              Concluídas no dia de hoje
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPending}</div>
            <p className="text-xs text-muted-foreground">
              Aguardando ligação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompleted}</div>
            <p className="text-xs text-muted-foreground">
              No período selecionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conclusão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate}%</div>
            <p className="text-xs text-muted-foreground">
              Do total de ligações
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Estatísticas por Etiqueta */}
      {tagStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TagIcon className="h-5 w-5" />
              Ligações por Etiqueta
            </CardTitle>
            <CardDescription>
              Distribuição de ligações por classificação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tagStats.map(({ tag, total, completed, pending }) => {
                const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
                return (
                  <div key={tag.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3 flex-1">
                      <Badge
                        variant="outline"
                        style={{
                          backgroundColor: `${tag.color}20`,
                          borderColor: tag.color,
                          color: tag.color,
                        }}
                      >
                        {tag.name}
                      </Badge>
                      <div className="flex-1">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            Total: <strong className="text-foreground">{total}</strong>
                          </span>
                          <span className="text-muted-foreground">
                            Concluídas: <strong className="text-success">{completed}</strong>
                          </span>
                          <span className="text-muted-foreground">
                            Pendentes: <strong className="text-warning">{pending}</strong>
                          </span>
                        </div>
                        <div className="mt-2 w-full bg-secondary rounded-full h-2">
                          <div 
                            className="h-2 rounded-full bg-success transition-all"
                            style={{ width: `${completionRate}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{completionRate}%</div>
                        <div className="text-xs text-muted-foreground">conclusão</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

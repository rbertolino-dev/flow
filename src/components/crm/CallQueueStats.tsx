import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CallQueueItem } from "@/types/lead";
import { Phone, CheckCircle2, Clock, TrendingUp, Tag as TagIcon, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTags } from "@/hooks/useTags";
import { format, isToday, isAfter, isBefore, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CallQueueStatsProps {
  callQueue: CallQueueItem[];
}

export function CallQueueStats({ callQueue }: CallQueueStatsProps) {
  const { tags: allTags } = useTags();
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [selectedTagId, setSelectedTagId] = useState<string>("all");
  const [responsibleIndex, setResponsibleIndex] = useState<Array<{
    responsible: string;
    totalCalls: number;
    descriptions: Array<{
      leadName: string;
      description: string;
      completedAt: string;
    }>;
  }>>([]);
  const [loadingResponsibleIndex, setLoadingResponsibleIndex] = useState(false);

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

  // Buscar índice de responsáveis
  useEffect(() => {
    const fetchResponsibleIndex = async () => {
      setLoadingResponsibleIndex(true);
      try {
        const orgId = await getUserOrganizationId();
        if (!orgId) return;

        // Data de 7 dias atrás
        const sevenDaysAgo = subDays(new Date(), 7).toISOString();

        // Buscar todas as ligações concluídas
        const { data: historyData, error } = await supabase
          .from('call_queue_history')
          .select('completed_by, call_notes, lead_name, completed_at')
          .eq('organization_id', orgId)
          .eq('action', 'completed')
          .not('completed_by', 'is', null)
          .order('completed_at', { ascending: false });

        if (error) throw error;

        // Agrupar por responsável
        const groupedByResponsible = new Map<string, {
          totalCalls: number;
          descriptions: Array<{
            leadName: string;
            description: string;
            completedAt: string;
          }>;
        }>();

        (historyData || []).forEach((item: any) => {
          const responsible = item.completed_by || 'Nenhum responsável atribuído';
          
          if (!groupedByResponsible.has(responsible)) {
            groupedByResponsible.set(responsible, {
              totalCalls: 0,
              descriptions: [],
            });
          }

          const group = groupedByResponsible.get(responsible)!;
          group.totalCalls += 1;

          // Adicionar descrição apenas se tiver call_notes e for dos últimos 7 dias
          if (item.call_notes && item.completed_at && new Date(item.completed_at) >= new Date(sevenDaysAgo)) {
            group.descriptions.push({
              leadName: item.lead_name || 'Lead sem nome',
              description: item.call_notes,
              completedAt: item.completed_at,
            });
          }
        });

        // Converter para array e ordenar por total de ligações
        const indexArray = Array.from(groupedByResponsible.entries())
          .map(([responsible, data]) => ({
            responsible,
            ...data,
          }))
          .sort((a, b) => b.totalCalls - a.totalCalls);

        setResponsibleIndex(indexArray);
      } catch (error: any) {
        console.error('Erro ao buscar índice de responsáveis:', error);
      } finally {
        setLoadingResponsibleIndex(false);
      }
    };

    fetchResponsibleIndex();
  }, []);

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

      {/* Índice de Responsáveis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Índice de Responsáveis
          </CardTitle>
          <CardDescription>
            Informações de cada responsável que concluiu ligações e descrições dos últimos 7 dias
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingResponsibleIndex ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : responsibleIndex.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {responsibleIndex.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-lg">{item.responsible}</p>
                        <p className="text-sm text-muted-foreground">
                          Total de ligações concluídas: {item.totalCalls}
                        </p>
                      </div>
                    </div>
                    
                    {item.descriptions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          Descrições dos últimos 7 dias ({item.descriptions.length}):
                        </p>
                        <div className="space-y-2">
                          {item.descriptions.map((desc, descIndex) => (
                            <div key={descIndex} className="bg-muted/50 rounded-md p-3 space-y-1">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">{desc.leadName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(desc.completedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                              <p className="text-sm text-foreground">{desc.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {item.descriptions.length === 0 && (
                      <p className="text-sm text-muted-foreground italic">
                        Nenhuma descrição adicionada nos últimos 7 dias
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum responsável encontrado com ligações concluídas
            </p>
          )}
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

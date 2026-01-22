import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReports, ReportMetrics } from "@/hooks/useReports";
import { Lead } from "@/types/lead";
import { CallQueueItem } from "@/types/lead";
import { PipelineStage } from "@/hooks/usePipelineStages";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, TrendingUp, DollarSign, Users, MessageSquare, Phone, BarChart3, GitBranch, UserCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { SalesFunnelVisualization } from "./SalesFunnelVisualization";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SalesReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  stages: PipelineStage[];
  callQueue: CallQueueItem[];
}

export function SalesReportDialog({ open, onOpenChange, leads, stages, callQueue }: SalesReportDialogProps) {
  // Função para obter primeiro dia do mês atual
  const getFirstDayOfMonth = () => {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  // Função para obter último dia do mês atual
  const getLastDayOfMonth = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(0);
    date.setHours(23, 59, 59, 999);
    return date;
  };

  const [startDate, setStartDate] = useState<Date | undefined>(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState<Date | undefined>(getLastDayOfMonth());
  const [dateFilterMode, setDateFilterMode] = useState<'thisMonth' | 'last30Days' | 'custom'>('thisMonth');
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

  const metrics = useReports({ leads, stages, callQueue, startDate, endDate });

  // Buscar índice de responsáveis
  useEffect(() => {
    const fetchResponsibleIndex = async () => {
      if (!open) return;
      
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
  }, [open]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Relatórios do Funil de Vendas
          </DialogTitle>
        </DialogHeader>

        {/* Filtros de Período */}
        <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2 flex-wrap">
            <Label>Período:</Label>
            <Button
              variant={dateFilterMode === 'thisMonth' ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDateFilterMode('thisMonth');
                setStartDate(getFirstDayOfMonth());
                setEndDate(getLastDayOfMonth());
              }}
            >
              Este mês
            </Button>
            <Button
              variant={dateFilterMode === 'last30Days' ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDateFilterMode('last30Days');
                const date = new Date();
                date.setDate(date.getDate() - 30);
                date.setHours(0, 0, 0, 0);
                setStartDate(date);
                const end = new Date();
                end.setHours(23, 59, 59, 999);
                setEndDate(end);
              }}
            >
              Últimos 30 dias
            </Button>
            <Button
              variant={dateFilterMode === 'custom' ? "default" : "outline"}
              size="sm"
              onClick={() => setDateFilterMode('custom')}
            >
              Personalizado
            </Button>
          </div>

          {dateFilterMode === 'custom' && (
            <div className="flex items-center gap-2 flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[200px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? formatDate(startDate) : "Data inicial"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
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
                  <Button variant="outline" size="sm" className="w-[200px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? formatDate(endDate) : "Data final"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        {/* Abas para alternar entre visualização de funil e tabelas */}
        <Tabs defaultValue="funnel" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="funnel" className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Visualização de Funil
            </TabsTrigger>
            <TabsTrigger value="tables" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Relatórios Detalhados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="funnel" className="space-y-4">
            <SalesFunnelVisualization metrics={metrics} stages={stages} />
          </TabsContent>

          <TabsContent value="tables" className="space-y-4">
            {/* Cards de Métricas Principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.totalLeads}</div>
                  <p className="text-xs text-muted-foreground">
                    {startDate && endDate && `${formatDate(startDate)} - ${formatDate(endDate)}`}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(metrics.totalValue)}</div>
                  <p className="text-xs text-muted-foreground">
                    Ticket médio: {formatCurrency(metrics.averageTicket)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.conversionRate}%</div>
                  <p className="text-xs text-muted-foreground">
                    Leads na última etapa
                  </p>
                  <p className="text-xs text-blue-600 mt-1 font-medium">
                    ℹ️ Conversão: Leads que chegaram na última etapa ÷ Total de leads
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Mensagens Não Lidas</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.unreadMessagesCount}</div>
                  <p className="text-xs text-muted-foreground">
                    Leads aguardando resposta
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Métricas por Etapa */}
            <Card>
              <CardHeader>
                <CardTitle>Métricas por Etapa</CardTitle>
                <CardDescription>Distribuição de leads e performance por etapa do funil</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Etapa</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead className="text-right">Ticket Médio</TableHead>
                        <TableHead className="text-right">Taxa Conversão</TableHead>
                        <TableHead className="text-right">Tempo Médio (dias)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.stageMetrics.map((stage) => (
                        <TableRow key={stage.stageId}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: stage.stageColor }}
                              />
                              <span className="font-medium">{stage.stageName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{stage.leadCount}</TableCell>
                          <TableCell className="text-right">{formatCurrency(stage.totalValue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(stage.averageTicket)}</TableCell>
                          <TableCell className="text-right">
                            {stage.conversionRate > 0 ? `${stage.conversionRate.toFixed(1)}%` : '-'}
                          </TableCell>
                          <TableCell className="text-right">{stage.averageTimeInStage.toFixed(1)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Métricas por Tag */}
        <Card>
          <CardHeader>
            <CardTitle>Métricas por Tag</CardTitle>
            <CardDescription>Performance de leads agrupados por tags</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.tagMetrics.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tag</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead className="text-right">Ticket Médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.tagMetrics.map((tag) => (
                      <TableRow key={tag.tagId}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            style={{
                              backgroundColor: `${tag.tagColor}20`,
                              borderColor: tag.tagColor,
                              color: tag.tagColor,
                            }}
                          >
                            {tag.tagName}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{tag.leadCount}</TableCell>
                        <TableCell className="text-right">{formatCurrency(tag.totalValue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(tag.averageTicket)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma tag encontrada no período selecionado
              </p>
            )}
          </CardContent>
        </Card>

        {/* Leads sem Etiquetas */}
        {metrics.leadsWithoutTags.leadCount > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Leads sem Etiquetas</CardTitle>
              <CardDescription>Leads que não possuem nenhuma etiqueta atribuída</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Leads</p>
                  <p className="text-2xl font-bold">{metrics.leadsWithoutTags.leadCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(metrics.leadsWithoutTags.totalValue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ticket Médio</p>
                  <p className="text-2xl font-bold">{formatCurrency(metrics.leadsWithoutTags.averageTicket)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Métricas por Origem */}
        {metrics.sourceMetrics.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Métricas por Origem</CardTitle>
              <CardDescription>Performance de leads por instância/origem</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Origem</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead className="text-right">Ticket Médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.sourceMetrics.map((source, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{source.sourceName}</TableCell>
                        <TableCell className="text-right">{source.leadCount}</TableCell>
                        <TableCell className="text-right">{formatCurrency(source.totalValue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(source.averageTicket)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Métricas da Fila de Ligações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Fila de Ligações
            </CardTitle>
            <CardDescription>Estatísticas da fila de ligações no período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{metrics.callQueueMetrics.totalPending}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Concluídas</p>
                <p className="text-2xl font-bold">{metrics.callQueueMetrics.totalCompleted}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reagendadas</p>
                <p className="text-2xl font-bold">{metrics.callQueueMetrics.totalRescheduled}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa Conclusão</p>
                <p className="text-2xl font-bold">{metrics.callQueueMetrics.completionRate}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Média Ligações</p>
                <p className="text-2xl font-bold">{metrics.callQueueMetrics.averageCallsPerLead}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Evolução Diária */}
        {metrics.dailyLeads.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Evolução Diária</CardTitle>
              <CardDescription>Leads criados por dia no período</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Leads Criados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.dailyLeads.map((daily) => (
                      <TableRow key={daily.date}>
                        <TableCell>{format(new Date(daily.date), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                        <TableCell className="text-right">{daily.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

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
      </DialogContent>
    </Dialog>
  );
}


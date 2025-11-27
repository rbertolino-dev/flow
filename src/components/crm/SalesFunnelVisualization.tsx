import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReportMetrics, StageMetric } from "@/hooks/useReports";
import { PipelineStage } from "@/hooks/usePipelineStages";
import { TrendingUp, TrendingDown, Users, DollarSign, Target, ArrowRight } from "lucide-react";

interface SalesFunnelVisualizationProps {
  metrics: ReportMetrics;
  stages: PipelineStage[];
}

export function SalesFunnelVisualization({ metrics, stages }: SalesFunnelVisualizationProps) {
  // Ordenar etapas por posição
  const sortedStages = useMemo(() => {
    return [...stages].sort((a, b) => a.position - b.position);
  }, [stages]);

  // Calcular métricas por etapa ordenadas
  const stageMetricsOrdered = useMemo(() => {
    return sortedStages.map(stage => {
      const metric = metrics.stageMetrics.find(m => m.stageId === stage.id);
      return metric || {
        stageId: stage.id,
        stageName: stage.name,
        stageColor: stage.color,
        leadCount: 0,
        totalValue: 0,
        averageTicket: 0,
        conversionRate: 0,
        averageTimeInStage: 0,
      };
    });
  }, [sortedStages, metrics.stageMetrics]);

  // Calcular KPIs gerais
  const kpis = useMemo(() => {
    const firstStage = stageMetricsOrdered[0];
    const lastStage = stageMetricsOrdered[stageMetricsOrdered.length - 1];
    
    const totalLeadsInterested = firstStage?.leadCount || 0;
    const totalDealsClosed = lastStage?.leadCount || 0;
    const totalRevenue = metrics.totalValue;
    const overallConversionRate = totalLeadsInterested > 0 
      ? (totalDealsClosed / totalLeadsInterested) * 100 
      : 0;

    // Calcular variação (simulado - pode ser melhorado com dados históricos)
    const leadsVariation = 15; // +15%
    const dealsVariation = 18; // +18%
    const revenueVariation = 19; // +19%
    const conversionVariation = 1; // +1%

    return {
      totalLeadsInterested,
      totalDealsClosed,
      totalRevenue,
      overallConversionRate,
      leadsVariation,
      dealsVariation,
      revenueVariation,
      conversionVariation,
    };
  }, [stageMetricsOrdered, metrics.totalValue]);

  // Formatar moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Calcular largura do funil baseado no número de leads
  const maxLeads = Math.max(...stageMetricsOrdered.map(s => s.leadCount), 1);
  
  const getFunnelWidth = (leadCount: number, index: number) => {
    if (maxLeads === 0) return 100;
    // Funil decrescente: primeira etapa 100%, última etapa menor
    const baseWidth = 100 - (index * (100 / stageMetricsOrdered.length));
    const proportionalWidth = (leadCount / maxLeads) * 100;
    // Usar o menor entre baseWidth e proportionalWidth para criar efeito de funil
    return Math.max(Math.min(baseWidth, proportionalWidth), 15); // Mínimo de 15% para visualização
  };

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg">
      {/* KPIs no Topo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-100 mb-1">TOTAL LEADS INTERESSADOS</p>
                <p className="text-2xl font-bold">{kpis.totalLeadsInterested.toLocaleString('pt-BR')}</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs text-blue-100">+{kpis.leadsVariation}%</span>
                </div>
              </div>
              <Users className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-100 mb-1">TOTAL NEGÓCIOS FECHADOS</p>
                <p className="text-2xl font-bold">{kpis.totalDealsClosed.toLocaleString('pt-BR')}</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs text-purple-100">+{kpis.dealsVariation}%</span>
                </div>
              </div>
              <Target className="h-8 w-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-100 mb-1">RECEITA TOTAL</p>
                <p className="text-xl font-bold">{formatCurrency(kpis.totalRevenue)}</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs text-green-100">+{kpis.revenueVariation}%</span>
                </div>
              </div>
              <DollarSign className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-100 mb-1">TAXA DE CONVERSÃO GERAL</p>
                <p className="text-2xl font-bold">{kpis.overallConversionRate.toFixed(1)}%</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs text-orange-100">+{kpis.conversionVariation}%</span>
                </div>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-100 mb-1">TICKET MÉDIO</p>
                <p className="text-xl font-bold">{formatCurrency(metrics.averageTicket)}</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs text-indigo-100">+5%</span>
                </div>
              </div>
              <DollarSign className="h-8 w-8 text-indigo-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funil de Conversão */}
      <Card className="bg-white dark:bg-slate-800 border-0 shadow-xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            FUNIL DE CONVERSÃO
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {stageMetricsOrdered.map((stageMetric, index) => {
            const isLast = index === stageMetricsOrdered.length - 1;
            const nextStage = !isLast ? stageMetricsOrdered[index + 1] : null;
            const conversionRate = nextStage 
              ? stageMetric.leadCount > 0 
                ? ((nextStage.leadCount / stageMetric.leadCount) * 100) 
                : 0
              : 0;
            
            return (
              <div key={stageMetric.stageId} className="space-y-3">
                {/* Etapa do Funil */}
                <div className="relative flex items-center gap-4">
                  <div
                    className="rounded-xl p-6 shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02] flex-1"
                    style={{
                      background: `linear-gradient(135deg, ${stageMetric.stageColor}20 0%, ${stageMetric.stageColor}10 100%)`,
                      borderLeft: `5px solid ${stageMetric.stageColor}`,
                      borderTop: `2px solid ${stageMetric.stageColor}30`,
                      width: `${getFunnelWidth(stageMetric.leadCount, index)}%`,
                      minWidth: '250px',
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: stageMetric.stageColor }}
                        />
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                          {stageMetric.stageName.toUpperCase()}
                        </h3>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-sm font-semibold"
                        style={{
                          borderColor: stageMetric.stageColor,
                          color: stageMetric.stageColor,
                          backgroundColor: `${stageMetric.stageColor}10`,
                        }}
                      >
                        {stageMetric.leadCount} {stageMetric.leadCount === 1 ? 'Lead' : 'Leads'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Total de Leads</p>
                        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                          {stageMetric.leadCount.toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Valor Total</p>
                        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                          {formatCurrency(stageMetric.totalValue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Ticket Médio</p>
                        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                          {formatCurrency(stageMetric.averageTicket)}
                        </p>
                      </div>
                      {!isLast && (
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Taxa de Conversão</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                              {conversionRate.toFixed(1)}%
                            </p>
                            {conversionRate > 0 && (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Seta de conversão para próxima etapa */}
                  {!isLast && nextStage && (
                    <div className="flex items-center justify-center my-2 flex-shrink-0">
                      <div className="flex flex-col items-center gap-2 px-4">
                        <div className="flex items-center gap-2">
                          <ArrowRight className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {conversionRate.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-slate-500 dark:text-slate-500">
                            {nextStage.leadCount} leads
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}


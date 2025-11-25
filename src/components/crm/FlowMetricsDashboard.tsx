import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFlowMetrics } from "@/hooks/useFlowMetrics";
import { Loader2, TrendingUp, Play, Pause, FileText, CheckCircle2, Clock, AlertCircle, BarChart3 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function FlowMetricsDashboard() {
  const { metrics, loading } = useFlowMetrics();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Nenhuma métrica disponível
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          Métricas de Fluxos
        </h2>
        <p className="text-muted-foreground">
          Acompanhe o desempenho dos seus fluxos de automação
        </p>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Fluxos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalFlows}</div>
            <div className="flex gap-4 text-xs text-muted-foreground mt-2">
              <span className="flex items-center gap-1">
                <Play className="h-3 w-3 text-green-500" />
                {metrics.activeFlows} ativos
              </span>
              <span className="flex items-center gap-1">
                <Pause className="h-3 w-3 text-yellow-500" />
                {metrics.pausedFlows} pausados
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Execuções</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalExecutions}</div>
            <div className="flex gap-4 text-xs text-muted-foreground mt-2">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-blue-500" />
                {metrics.runningExecutions} em execução
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {metrics.completedExecutions} concluídas
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conclusão</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.completionRate.toFixed(1)}%</div>
            <Progress value={metrics.completionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.averageExecutionTime > 0
                ? `${metrics.averageExecutionTime.toFixed(1)}h`
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Tempo médio de execução
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status de Execuções */}
      <Card>
        <CardHeader>
          <CardTitle>Status das Execuções</CardTitle>
          <CardDescription>Distribuição atual das execuções</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <div>
                <p className="text-sm font-medium">Em Execução</p>
                <p className="text-2xl font-bold">{metrics.runningExecutions}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div>
                <p className="text-sm font-medium">Aguardando</p>
                <p className="text-2xl font-bold">{metrics.waitingExecutions}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <div>
                <p className="text-sm font-medium">Concluídas</p>
                <p className="text-2xl font-bold">{metrics.completedExecutions}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div>
                <p className="text-sm font-medium">Com Erro</p>
                <p className="text-2xl font-bold">{metrics.errorExecutions}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Fluxos */}
      {metrics.topFlows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fluxos Mais Executados</CardTitle>
            <CardDescription>Top 5 fluxos por número de execuções</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.topFlows.map((flow, index) => (
                <div key={flow.flowId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{flow.flowName}</p>
                      <p className="text-sm text-muted-foreground">
                        {flow.executionCount} execuções
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{flow.completionRate.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">Taxa de conclusão</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

